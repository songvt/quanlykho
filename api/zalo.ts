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
                const { data, error } = await supabase.from('zalo_notification_logs').select('*').order('created_at', { ascending: false }).limit(200);
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

        if (action === 'register_webhook') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
            const { bot_token, webhook_url } = req.body;
            if (!bot_token || !webhook_url) return res.status(400).json({ error: 'Missing bot_token or webhook_url' });

            const endpoint = `https://bot-api.zapps.me/bot${bot_token}/setWebhook`;
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: webhook_url,
                        secret_token: 'ggs123456'
                    })
                });
                const data = await response.json();
                return res.status(200).json({ success: true, data });
            } catch (err: any) {
                return res.status(500).json({ error: err.message });
            }
        }

        // --- ZALO PERSONAL BOT ---
        if (action === 'bot_webhook') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
            
            // Lấy token từ query param (webhook URL format: /api/zalo?action=bot_webhook&token=BOT_TOKEN)
            const bot_token = req.query.token as string;
            
            // Hoặc kiểm tra event từ req.body
            let payload = req.body;
            if (typeof payload === 'string') {
                try { payload = JSON.parse(payload); } catch(e) {}
            }
            
            // LOG TO DB TO DEBUG
            try {
                await supabase.from('zalo_webhook_events').insert({
                    event_name: 'bot_webhook',
                    app_id: bot_token || 'unknown',
                    sender_id: '',
                    message_text: '',
                    raw_payload: payload
                });
            } catch(e) {}

            console.log('[Zalo Webhook Payload]:', JSON.stringify(payload));
            
            // Xử lý event tin nhắn mới
            // Payload webhook của Zalo giống hệt format của 1 update trong getUpdates
            // Hoặc có thể là { event_name: 'user_send_text', sender: { id: '...' }, message: { text: '...' } }
            // Cần parse đúng chuẩn của Webhook!
            
            let zalo_user_id = '';
            let message_id = '';
            let sender_name = '';
            let message_content = '';

            // --- Parse Payload y hệt Apps Script ---
            try {
                const data = Array.isArray(payload) ? payload[0] : payload;
                const msg = data.message;
                
                if (msg) {
                    zalo_user_id = msg.chat?.id?.toString() || "";
                    message_id = msg.message_id?.toString() || `${zalo_user_id}_${Date.now()}`;
                    sender_name = msg.from?.display_name || "";
                    message_content = msg.text || "";
                } else if (data.sender && data.sender.id) {
                    // Fallback cho Zalo OA chuẩn
                    zalo_user_id = data.sender.id.toString();
                    message_id = data.message?.msg_id?.toString() || `${zalo_user_id}_${Date.now()}`;
                    sender_name = `User ${zalo_user_id}`;
                    message_content = data.message?.text || "";
                }
            } catch (error) {
                console.log("Webhook parse error:", error);
            }

            if (zalo_user_id && message_id) {
                // Lưu vào zalo_bot_inbox
                await supabase.from('zalo_bot_inbox').upsert([{
                    zalo_user_id: zalo_user_id,
                    message_id: message_id,
                    sender_name: sender_name,
                    message_content: message_content,
                    bot_token: bot_token || 'unknown_token' // Nếu ko truyền token thì để unknown
                }], { onConflict: 'message_id' });

                // Lưu vào danh bạ (personal_contacts)
                const { data: existing } = await supabase
                    .from('zalo_personal_contacts')
                    .select('id')
                    .eq('zalo_user_id', zalo_user_id)
                    .eq('bot_api_token', bot_token)
                    .single();
                
                if (!existing && bot_token) {
                    await supabase.from('zalo_personal_contacts').insert({
                        employee_id: `webhook_${zalo_user_id}`,
                        receiver_name: sender_name,
                        zalo_user_id: zalo_user_id,
                        bot_api_token: bot_token,
                        bot_name: 'Bot Webhook',
                        notes: 'Đồng bộ từ Webhook',
                        status: 'Hoạt động'
                    });
                }
            }

            return res.status(200).json({ success: true, message: 'Webhook received' });
        }

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
                const inboxMessages: any[] = [];

                updates.forEach((update: any) => {
                    if (update.message && update.message.from) {
                        const from = update.message.from;
                        const text = update.message.text || '';
                        const msgId = update.message.message_id?.toString() || `${from.id}_${update.update_id}`;

                        uniqueUsers.set(from.id.toString(), {
                            zalo_user_id: from.id.toString(),
                            receiver_name: from.first_name || from.username || `User ${from.id}`
                        });

                        inboxMessages.push({
                            zalo_user_id: from.id.toString(),
                            message_id: msgId,
                            sender_name: from.first_name || from.username || `User ${from.id}`,
                            message_content: text,
                            bot_token: bot_token
                        });
                    }
                });

                // Lưu tin nhắn vào inbox
                if (inboxMessages.length > 0) {
                    await supabase.from('zalo_bot_inbox').upsert(inboxMessages, { onConflict: 'message_id' });
                }

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
                const { contact_ids, message, custom_messages } = req.body;
                
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
                        let finalMessage = custom_messages && custom_messages[contact.id] ? custom_messages[contact.id] : message;
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
