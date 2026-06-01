import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_utils/supabase.js';
import { getOAQuota, fetchZaloTemplates, sendZNSMessage } from './_utils/zaloService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    try {
        // --- ZALO CONFIG ---
        if (action === 'config') {
            if (req.method === 'GET') {
                const { data, error } = await supabase.from('zalo_configs').select('*').single();
                if (error && error.code !== 'PGRST116') throw error;
                return res.status(200).json({ success: true, data });
            }
            if (req.method === 'POST') {
                const payload = req.body;
                // Upsert logic
                const { data: existing } = await supabase.from('zalo_configs').select('id').single();
                
                let result;
                if (existing) {
                    result = await supabase.from('zalo_configs').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existing.id).select();
                } else {
                    result = await supabase.from('zalo_configs').insert(payload).select();
                }
                if (result.error) throw result.error;
                return res.status(200).json({ success: true, data: result.data[0] });
            }
        }

        if (action === 'test_connection') {
            const { data: config } = await supabase.from('zalo_configs').select('access_token_encrypted, app_id').single();
            if (!config || !config.access_token_encrypted) return res.status(400).json({ error: 'Missing config' });
            
            const quota = await getOAQuota(config.access_token_encrypted);
            if (quota.error) throw new Error(quota.message || 'Zalo API Error');
            
            await supabase.from('zalo_configs').update({ is_active: true, last_checked_at: new Date().toISOString(), last_check_status: 'SUCCESS' }).eq('app_id', config.app_id);
            return res.status(200).json({ success: true, quota });
        }

        // --- ZALO TEMPLATES ---
        if (action === 'templates') {
            if (req.method === 'GET') {
                const { data, error } = await supabase.from('zalo_templates').select('*').order('created_at', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
        }

        if (action === 'sync_templates') {
            const { data: config } = await supabase.from('zalo_configs').select('access_token_encrypted').single();
            if (!config || !config.access_token_encrypted) return res.status(400).json({ error: 'Missing access token' });
            
            const zaloRes = await fetchZaloTemplates(config.access_token_encrypted);
            if (zaloRes.error) throw new Error(zaloRes.message || 'Failed to fetch templates');
            
            const templates = zaloRes.data || [];
            for (const t of templates) {
                const upsertData = {
                    template_id: t.templateId?.toString(),
                    template_name: t.templateName,
                    status: t.status,
                    is_active: t.status === '1' || t.status === 1,
                    last_synced_at: new Date().toISOString()
                };
                
                await supabase.from('zalo_templates').upsert(upsertData, { onConflict: 'template_id' });
            }
            return res.status(200).json({ success: true, message: `Synced ${templates.length} templates` });
        }

        // --- ZALO CAMPAIGNS & LOGS ---
        if (action === 'campaigns') {
            if (req.method === 'GET') {
                const { data, error } = await supabase.from('zalo_campaigns').select('*, zalo_templates(*)').order('created_at', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (req.method === 'POST') {
                // Create Campaign & Logs
                const { name, template_id, recipients, template_data } = req.body;
                
                const { data: campaign, error: campError } = await supabase.from('zalo_campaigns').insert({
                    name,
                    template_id,
                    total_recipients: recipients.length,
                    status: 'processing'
                }).select().single();
                if (campError) throw campError;

                const logs = recipients.map((r: any) => ({
                    campaign_id: campaign.id,
                    template_id: template_id,
                    recipient_phone: r.phone,
                    params: template_data,
                    idempotency_key: `${campaign.id}_${r.phone}_${Date.now()}`,
                    status: 'pending'
                }));

                const { error: logError } = await supabase.from('zalo_notification_logs').insert(logs);
                if (logError) throw logError;

                return res.status(200).json({ success: true, campaign });
            }
        }

        if (action === 'logs') {
            if (req.method === 'GET') {
                const { data, error } = await supabase.from('zalo_notification_logs').select('*, zalo_campaigns(name), zalo_templates(template_name)').order('created_at', { ascending: false }).limit(200);
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
        }

        // --- ZALO WORKER (Cron / Queue Processor) ---
        if (action === 'worker') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
            
            const { data: config } = await supabase.from('zalo_configs').select('access_token_encrypted, is_active').single();
            if (!config || !config.is_active || !config.access_token_encrypted) {
                return res.status(200).json({ success: false, message: 'Zalo config inactive or missing' });
            }

            // Fetch pending or retrying
            const { data: jobs, error } = await supabase
                .from('zalo_notification_logs')
                .select('*, zalo_templates(template_id)')
                .or('status.eq.pending,and(status.eq.retrying,next_retry_at.lte.now())')
                .limit(20); // Process 20 per tick to avoid limits
            
            if (error) throw error;
            if (!jobs || jobs.length === 0) return res.status(200).json({ success: true, processed: 0 });

            let processed = 0;
            for (const job of jobs) {
                try {
                    const payload = {
                        phone: job.recipient_phone,
                        template_id: job.zalo_templates.template_id,
                        template_data: job.params,
                        tracking_id: job.idempotency_key
                    };
                    
                    const response = await sendZNSMessage(config.access_token_encrypted, payload);
                    
                    if (response.error) {
                        // Mark as failed or retrying
                        const attempt = (job.attempt_count || 0) + 1;
                        if (attempt >= job.max_attempts) {
                            await supabase.from('zalo_notification_logs').update({
                                status: 'failed',
                                error_code: response.error,
                                error_message: response.message,
                                attempt_count: attempt,
                                failed_at: new Date().toISOString()
                            }).eq('id', job.id);
                        } else {
                            // Retry in 5 minutes
                            const nextRetry = new Date(Date.now() + 5 * 60000).toISOString();
                            await supabase.from('zalo_notification_logs').update({
                                status: 'retrying',
                                error_code: response.error,
                                attempt_count: attempt,
                                next_retry_at: nextRetry
                            }).eq('id', job.id);
                        }
                    } else {
                        await supabase.from('zalo_notification_logs').update({
                            status: 'sent',
                            provider_message_id: response.data?.msg_id,
                            sent_at: new Date().toISOString()
                        }).eq('id', job.id);
                    }
                } catch (e: any) {
                    await supabase.from('zalo_notification_logs').update({
                        status: 'failed',
                        error_message: e.message,
                        failed_at: new Date().toISOString()
                    }).eq('id', job.id);
                }
                processed++;
            }
            
            return res.status(200).json({ success: true, processed });
        }

        // --- ZALO PERSONAL BOT ---
        if (action === 'sync_contacts') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
            const { bot_token, bot_name } = req.body;
            if (!bot_token) return res.status(400).json({ error: 'Thiếu bot_token' });

            // Import getBotUpdates
            const { getBotUpdates } = await import('./_utils/zaloPersonalService.js');
            
            try {
                const updates = await getBotUpdates(bot_token);
                if (!updates || updates.length === 0) {
                    return res.status(200).json({ success: true, count: 0, message: 'Không có tin nhắn mới nào để đồng bộ' });
                }

                const uniqueUsers = new Map();
                updates.forEach((update: any) => {
                    if (update.message && update.message.from) {
                        const from = update.message.from;
                        uniqueUsers.set(from.id.toString(), {
                            zalo_user_id: from.id.toString(),
                            receiver_name: from.first_name || from.username || `User ${from.id}`
                        });
                    }
                });

                if (uniqueUsers.size === 0) {
                    return res.status(200).json({ success: true, count: 0, message: 'Không tìm thấy ID người dùng trong các tin nhắn mới' });
                }

                let addedCount = 0;
                for (const [id, user] of uniqueUsers.entries()) {
                    // Check if exists
                    const { data: existing } = await supabase
                        .from('zalo_personal_contacts')
                        .select('id')
                        .eq('zalo_user_id', id)
                        .eq('bot_api_token', bot_token)
                        .single();
                    
                    if (!existing) {
                        await supabase.from('zalo_personal_contacts').insert({
                            employee_id: `sync_${id}`,
                            receiver_name: user.receiver_name,
                            zalo_user_id: user.zalo_user_id,
                            bot_api_token: bot_token,
                            bot_name: bot_name || 'Bot Đồng Bộ',
                            notes: 'Đồng bộ từ tin nhắn',
                            status: 'Hoạt động'
                        });
                        addedCount++;
                    }
                }

                return res.status(200).json({ success: true, count: addedCount, message: `Đã đồng bộ thành công ${addedCount} liên hệ mới!` });
            } catch (err: any) {
                return res.status(500).json({ error: err.message });
            }
        }

        if (action === 'send_personal') {
            if (req.method === 'POST') {
                const { contact_ids, message } = req.body;
                
                // Lấy danh sách contact
                const { data: contacts, error: contactError } = await supabase
                    .from('zalo_personal_contacts')
                    .select('*')
                    .in('id', contact_ids);
                
                if (contactError) throw contactError;
                if (!contacts || contacts.length === 0) return res.status(400).json({ error: 'Không tìm thấy liên hệ' });

                // Import service (dynamically if needed, or assume it's imported at the top)
                const { sendPersonalZaloMessage } = await import('./_utils/zaloPersonalService.js');

                let successCount = 0;
                let failCount = 0;

                // Gửi tuần tự để tránh rate limit
                for (const contact of contacts) {
                    try {
                        let finalMessage = message;
                        if (contact.receiver_name) {
                            finalMessage = finalMessage.replace(/\{name\}/g, contact.receiver_name);
                        }

                        // Thêm chữ ký tự động theo yêu cầu
                        finalMessage += '\n\nĐây là tin nhắn tự động không trả lời lại bot - liên hệ zalo songvt nhé !';

                        const zaloRes = await sendPersonalZaloMessage(contact.bot_api_token, contact.zalo_user_id, finalMessage);
                        
                        // Cập nhật trạng thái
                        await supabase.from('zalo_personal_contacts')
                            .update({ status: 'Đã gửi' })
                            .eq('id', contact.id);

                        // Ghi log
                        await supabase.from('zalo_notification_logs').insert({
                            recipient_phone: contact.phone || contact.zalo_user_id,
                            status: 'sent',
                            provider_message_id: zaloRes?.result?.message_id?.toString(),
                            sent_at: new Date().toISOString(),
                            params: { message: finalMessage, type: 'personal_bot', bot_name: contact.bot_name }
                        });
                        
                        successCount++;
                    } catch (e: any) {
                        console.error(`Lỗi gửi tin cho ${contact.receiver_name}:`, e.message);
                        failCount++;
                        // Ghi log thất bại
                        await supabase.from('zalo_notification_logs').insert({
                            recipient_phone: contact.phone || contact.zalo_user_id,
                            status: 'failed',
                            error_message: e.message,
                            failed_at: new Date().toISOString(),
                            params: { type: 'personal_bot', bot_name: contact.bot_name }
                        });
                    }
                    
                    // Delay 500ms
                    await new Promise(r => setTimeout(r, 500));
                }

                return res.status(200).json({ 
                    success: true, 
                    message: `Đã gửi xong. Thành công: ${successCount}, Thất bại: ${failCount}` 
                });
            }
        }

        // --- ZALO WEBHOOK ---
        if (action === 'webhook') {
            // Zalo sends status updates here
            const payload = req.body;
            // Record event
            await supabase.from('zalo_webhook_events').insert({
                event_name: payload.event_name,
                provider_message_id: payload.message?.msg_id,
                payload: payload
            });

            // If it's a delivery status
            if (payload.message && payload.message.msg_id) {
                const statusMap: any = {
                    'delivered': 'delivered',
                    'read': 'read',
                    'failed': 'failed'
                };
                const newStatus = statusMap[payload.event_name];
                if (newStatus) {
                    await supabase.from('zalo_notification_logs').update({
                        status: newStatus,
                        updated_at: new Date().toISOString()
                    }).eq('provider_message_id', payload.message.msg_id);
                }
            }

            return res.status(200).json({ success: true });
        }

        return res.status(404).json({ error: 'Action not found' });
    } catch (error: any) {
        console.error(`[Zalo API Error] action=${action}:`, error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
