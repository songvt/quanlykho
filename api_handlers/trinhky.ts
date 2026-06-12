import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_utils/supabase.js';
import { randomUUID } from 'crypto';

// Ensure storage bucket exists
const ensureTrinhKyBucketExists = async () => {
    try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) {
            console.error('[Supabase Storage] List buckets error:', error);
            return;
        }
        
        const exists = buckets?.some(b => b.name === 'trinhky-documents');
        if (!exists) {
            const { error: createError } = await supabase.storage.createBucket('trinhky-documents', {
                public: true,
                allowedMimeTypes: [
                    'application/pdf', 
                    'application/msword', 
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'application/zip',
                    'application/x-rar-compressed'
                ],
                fileSizeLimit: 104857600 // 100MB
            });
            if (createError) {
                console.error('[Supabase Storage] Create bucket error:', createError);
            } else {
                console.log('[Supabase Storage] Created bucket "trinhky-documents" successfully.');
            }
        }
    } catch (err) {
        console.error('[Supabase Storage] Exception ensuring bucket exists:', err);
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Bucket is verified and created on Supabase
    // await ensureTrinhKyBucketExists();

    const { id, type } = req.query;

    try {
        // --- 1. GET - Fetch Documents List or Detail ---
        if (req.method === 'GET') {
            if (id) {
                // Get Detailed Document Info
                const { data: doc, error: docError } = await supabase
                    .from('trinhky_hoso')
                    .select(`
                        *,
                        creator:employees!trinhky_hoso_nguoi_tao_fkey(id, full_name, email, role, job_position, department)
                    `)
                    .eq('id', id)
                    .single();

                if (docError || !doc) {
                    return res.status(404).json({ error: 'Không tìm thấy hồ sơ trình ký.' });
                }

                // Fetch Approvers
                const { data: approvers, error: appError } = await supabase
                    .from('trinhky_approver')
                    .select(`
                        *,
                        employee:employees!trinhky_approver_user_id_fkey(id, full_name, email, role, job_position, department)
                    `)
                    .eq('hoso_id', id)
                    .order('thu_tu_ky', { ascending: true });

                // Fetch Workflows
                const { data: workflows, error: wfError } = await supabase
                    .from('trinhky_workflow')
                    .select(`
                        *,
                        employee:employees!trinhky_workflow_user_id_fkey(id, full_name, email, role, job_position, department)
                    `)
                    .eq('hoso_id', id)
                    .order('action_time', { ascending: true });

                // Fetch Attachments
                const { data: attachments, error: attError } = await supabase
                    .from('trinhky_attachments')
                    .select(`
                        *,
                        uploader:employees!trinhky_attachments_upload_by_fkey(id, full_name, email, role, job_position, department)
                    `)
                    .eq('hoso_id', id)
                    .order('upload_time', { ascending: true });

                // Attach Public URLs to Attachments
                const formattedAttachments = (attachments || []).map(att => {
                    const publicUrl = supabase.storage.from('trinhky-documents').getPublicUrl(att.file_path).data.publicUrl;
                    return {
                        ...att,
                        public_url: publicUrl
                    };
                });

                return res.status(200).json({
                    ...doc,
                    approvers: approvers || [],
                    workflows: workflows || [],
                    attachments: formattedAttachments
                });
            }

            // Fetch list of documents
            const { userId, role, scope } = req.query; // Scope: 'pending', 'processed', 'list', etc.
            let query = supabase.from('trinhky_hoso').select(`
                *,
                creator:employees!trinhky_hoso_nguoi_tao_fkey(id, full_name, email, role, job_position, department)
            `).eq('is_delete', false);

            // Filter based on scope
            if (scope === 'pending') {
                // Documents waiting for current user to sign
                // Find all hoso IDs where the current user is active in trinhky_approver (status = 'DangXuly')
                const { data: myApprovals } = await supabase
                    .from('trinhky_approver')
                    .select('hoso_id')
                    .eq('user_id', userId as string)
                    .eq('trang_thai', 'DangXuly');
                
                const hosoIds = (myApprovals || []).map(a => a.hoso_id);
                if (hosoIds.length === 0) {
                    return res.status(200).json([]);
                }
                query = query.in('id', hosoIds).eq('trang_thai', 'Đang ký');
            } else if (scope === 'processed') {
                // Documents where current user has already signed or processed
                const { data: myActions } = await supabase
                    .from('trinhky_approver')
                    .select('hoso_id')
                    .eq('user_id', userId as string)
                    .in('trang_thai', ['DaKy', 'DaKyNhay', 'TuChoi', 'DaChuyen']);
                
                const hosoIds = (myActions || []).map(a => a.hoso_id);
                if (hosoIds.length === 0) {
                    return res.status(200).json([]);
                }
                query = query.in('id', hosoIds);
            } else {
                // Default view permissions: ROLE_ADMIN / ROLE_TRINHKY_VIEW can view all. Others can only view their own or where they are an approver.
                if (role !== 'admin' && role !== 'manager') {
                    // Get document IDs where user is creator OR user is an approver
                    const { data: approvals } = await supabase
                        .from('trinhky_approver')
                        .select('hoso_id')
                        .eq('user_id', userId as string);
                    
                    const hosoIds = (approvals || []).map(a => a.hoso_id);
                    query = query.or(`nguoi_tao.eq.${userId},id.in.(${hosoIds.length ? hosoIds.join(',') : randomUUID()})`);
                }
            }

            // Search filters
            const { keyword, status, loai_hoso, fromDate, toDate } = req.query;
            if (keyword) {
                query = query.or(`tieu_de.ilike.%${keyword}%,so_hoso.ilike.%${keyword}%`);
            }
            if (status) {
                query = query.eq('trang_thai', status as string);
            }
            if (loai_hoso) {
                query = query.eq('loai_hoso', loai_hoso as string);
            }
            if (fromDate) {
                query = query.gte('ngay_tao', fromDate as string);
            }
            if (toDate) {
                query = query.lte('ngay_tao', toDate as string);
            }

            query = query.order('ngay_tao', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            // For each hoso, attach current active signer
            const formattedList = await Promise.all((data || []).map(async (doc) => {
                const { data: activeApprovers } = await supabase
                    .from('trinhky_approver')
                    .select(`
                        employee:employees!trinhky_approver_user_id_fkey(full_name)
                    `)
                    .eq('hoso_id', doc.id)
                    .eq('trang_thai', 'DangXuly');
                
                const currentSigners = (activeApprovers || []).map(a => {
                    const emp = a.employee as any;
                    return Array.isArray(emp) ? emp[0]?.full_name : emp?.full_name;
                }).join(', ');
                return {
                    ...doc,
                    current_signer: currentSigners || (doc.trang_thai === 'Hoàn thành' ? 'Hoàn thành' : 'N/A')
                };
            }));

            return res.status(200).json(formattedList);
        }

        // --- 2. POST - Insert, Upload or Workflow Action ---
        if (req.method === 'POST') {
            const { action, payload } = req.body;

            // ACTION: CREATE / SAVE DRAFT
            if (action === 'create') {
                const { tieu_de, noi_dung, loai_hoso, do_mat, do_khan, nguoi_tao, don_vi, hinh_thuc_ky, approvers, attachments, sendImmediately } = payload;
                
                // 1. Generate Unique document code: TK-YYYY-XXXXXX
                const currentYear = new Date().getFullYear();
                const yearStr = String(currentYear);
                const prefix = `TK-${yearStr}-`;

                const { data: latestRecords, error: latestError } = await supabase
                    .from('trinhky_hoso')
                    .select('so_hoso')
                    .ilike('so_hoso', `${prefix}%`)
                    .order('so_hoso', { ascending: false })
                    .limit(1);

                let docNumber = 1;
                if (!latestError && latestRecords && latestRecords.length > 0) {
                    const lastCode = latestRecords[0].so_hoso;
                    const suffixStr = lastCode.split('-').pop();
                    if (suffixStr) {
                        docNumber = parseInt(suffixStr, 10) + 1;
                    }
                }
                const so_hoso = `${prefix}${String(docNumber).padStart(6, '0')}`;
                
                const initialStatus = sendImmediately ? 'Đang ký' : 'Nháp';
                const hosoId = randomUUID();

                // 2. Insert document record
                const { data: newDoc, error: insertError } = await supabase
                    .from('trinhky_hoso')
                    .insert({
                        id: hosoId,
                        so_hoso,
                        tieu_de,
                        noi_dung,
                        loai_hoso,
                        do_mat,
                        do_khan,
                        nguoi_tao,
                        don_vi,
                        hinh_thuc_ky: hinh_thuc_ky || 'tuan_tu',
                        trang_thai: initialStatus
                    })
                    .select()
                    .single();

                if (insertError) {
                    throw new Error(`Lỗi khởi tạo hồ sơ: ${insertError.message}`);
                }

                // 3. Create workflow log
                await supabase.from('trinhky_workflow').insert({
                    hoso_id: hosoId,
                    action: 'tao_moi',
                    user_id: nguoi_tao,
                    comment: 'Khởi tạo hồ sơ trình ký'
                });

                if (sendImmediately) {
                    await supabase.from('trinhky_workflow').insert({
                        hoso_id: hosoId,
                        action: 'gui_trinh',
                        user_id: nguoi_tao,
                        comment: 'Gửi trình ký chính thức'
                    });
                }

                // 4. Insert Approvers
                if (approvers && Array.isArray(approvers) && approvers.length > 0) {
                    const formattedApprovers = approvers.map((app: any, index: number) => {
                        let approverStatus = 'ChoKy';
                        if (sendImmediately) {
                            if (hinh_thuc_ky === 'song_song') {
                                approverStatus = 'DangXuly';
                            } else if (index === 0) {
                                approverStatus = 'DangXuly'; // In sequential, first one starts
                            }
                        }
                        return {
                            id: randomUUID(),
                            hoso_id: hosoId,
                            user_id: app.user_id,
                            thu_tu_ky: index + 1,
                            trang_thai: approverStatus
                        };
                    });

                    const { error: appError } = await supabase.from('trinhky_approver').insert(formattedApprovers);
                    if (appError) {
                        console.error('Approvers insert error:', appError);
                    }
                }

                // 5. Insert Attachments mapping
                if (attachments && Array.isArray(attachments) && attachments.length > 0) {
                    const formattedAttachments = attachments.map((att: any) => ({
                        id: randomUUID(),
                        hoso_id: hosoId,
                        file_name: att.file_name,
                        file_path: att.file_path,
                        file_size: att.file_size,
                        file_type: att.file_type || 'phu_luc',
                        upload_by: nguoi_tao
                    }));

                    const { error: attError } = await supabase.from('trinhky_attachments').insert(formattedAttachments);
                    if (attError) {
                        console.error('Attachments mapping error:', attError);
                    }
                }

                return res.status(200).json({
                    success: true,
                    document: newDoc
                });
            }

            // ACTION: UPLOAD ATTACHMENT
            if (action === 'upload') {
                const { fileName, mimeType, fileData, userId } = payload;
                if (!fileData) {
                    return res.status(400).json({ error: 'Thiếu dữ liệu file tải lên.' });
                }

                const buffer = Buffer.from(fileData, 'base64');
                const fileExt = fileName.split('.').pop() || 'dat';
                const storagePath = `attachments/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                // Upload to Storage
                const { error: uploadError } = await supabase.storage
                    .from('trinhky-documents')
                    .upload(storagePath, buffer, {
                        contentType: mimeType || 'application/octet-stream',
                        cacheControl: '3600',
                        upsert: true
                    });

                if (uploadError) {
                    throw new Error(`Lỗi lưu trữ tệp tin: ${uploadError.message}`);
                }

                return res.status(200).json({
                    success: true,
                    file_name: fileName,
                    file_path: storagePath,
                    file_size: buffer.length
                });
            }

            // ACTION: WORKFLOW ACTION (SIGN/APPROVE/REJECT/RECALL)
            if (action === 'workflow_action') {
                const { hoso_id, user_id, action_type, comment, next_user_id } = payload;
                
                // Fetch current document
                const { data: doc, error: docError } = await supabase
                    .from('trinhky_hoso')
                    .select('*')
                    .eq('id', hoso_id)
                    .single();

                if (docError || !doc) {
                    return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
                }

                // Check action type
                if (action_type === 'thu_hoi') {
                    // Recall document back to draft
                    await supabase.from('trinhky_hoso').update({ trang_thai: 'Thu hồi' }).eq('id', hoso_id);
                    await supabase.from('trinhky_approver').update({ trang_thai: 'ChoKy' }).eq('hoso_id', hoso_id);
                    await supabase.from('trinhky_workflow').insert({
                        hoso_id,
                        action: 'thu_hoi',
                        user_id,
                        comment: comment || 'Thu hồi hồ sơ trình ký'
                    });
                    return res.status(200).json({ success: true, message: 'Đã thu hồi hồ sơ.' });
                }

                if (action_type === 'gui_lai') {
                    // Resubmit draft/recalled document
                    await supabase.from('trinhky_hoso').update({ trang_thai: 'Đang ký' }).eq('id', hoso_id);
                    
                    // Reset first or all approvers to active
                    if (doc.hinh_thuc_ky === 'song_song') {
                        await supabase.from('trinhky_approver').update({ trang_thai: 'DangXuly', y_kien: null, ngay_ky: null }).eq('hoso_id', hoso_id);
                    } else {
                        // Reset all to ChoKy, and first one to DangXuly
                        await supabase.from('trinhky_approver').update({ trang_thai: 'ChoKy', y_kien: null, ngay_ky: null }).eq('hoso_id', hoso_id);
                        await supabase.from('trinhky_approver').update({ trang_thai: 'DangXuly' }).eq('hoso_id', hoso_id).eq('thu_tu_ky', 1);
                    }
                    
                    await supabase.from('trinhky_workflow').insert({
                        hoso_id,
                        action: 'gui_trinh',
                        user_id,
                        comment: comment || 'Gửi lại trình ký'
                    });
                    return res.status(200).json({ success: true, message: 'Đã gửi trình ký lại.' });
                }

                if (action_type === 'xoa_hoso') {
                    await supabase.from('trinhky_hoso').update({ is_delete: true }).eq('id', hoso_id);
                    return res.status(200).json({ success: true, message: 'Đã xóa hồ sơ.' });
                }

                // Handle signer actions: Approve, Sign flash (nháy), Reject, Edit Request, Forward
                const { data: myApproval, error: appError } = await supabase
                    .from('trinhky_approver')
                    .select('*')
                    .eq('hoso_id', hoso_id)
                    .eq('user_id', user_id)
                    .eq('trang_thai', 'DangXuly')
                    .single();

                if (appError || !myApproval) {
                    return res.status(403).json({ error: 'Bạn không có quyền ký duyệt hồ sơ này tại thời điểm này.' });
                }

                const now = new Date().toISOString();

                if (action_type === 'ky_duyet' || action_type === 'ky_nhay') {
                    const isNhay = action_type === 'ky_nhay';
                    const { signature_data } = payload;
                    
                    // Update current approver
                    await supabase
                        .from('trinhky_approver')
                        .update({
                            trang_thai: isNhay ? 'DaKyNhay' : 'DaKy',
                            ngay_ky: now,
                            y_kien: comment || (isNhay ? 'Đồng ý (ký nháy)' : 'Đồng ý ký duyệt'),
                            signature_data: signature_data || null
                        })
                        .eq('id', myApproval.id);

                    // Insert workflow log
                    await supabase.from('trinhky_workflow').insert({
                        hoso_id,
                        action: isNhay ? 'ky_nhay' : 'ky_duyet',
                        user_id,
                        comment: comment || (isNhay ? 'Ký nháy hồ sơ' : 'Ký duyệt hồ sơ')
                    });

                    // Determine next step in flow
                    if (doc.hinh_thuc_ky === 'song_song') {
                        // Parallel: check if anyone is still pending
                        const { data: pending } = await supabase
                            .from('trinhky_approver')
                            .select('id')
                            .eq('hoso_id', hoso_id)
                            .in('trang_thai', ['ChoKy', 'DangXuly']);
                        
                        if (!pending || pending.length === 0) {
                            // All signed
                            await supabase.from('trinhky_hoso').update({ trang_thai: 'Hoàn thành' }).eq('id', hoso_id);
                        }
                    } else {
                        // Sequential: activate next approver
                        const nextOrder = myApproval.thu_tu_ky + 1;
                        const { data: nextApprover } = await supabase
                            .from('trinhky_approver')
                            .select('*')
                            .eq('hoso_id', hoso_id)
                            .eq('thu_tu_ky', nextOrder)
                            .maybeSingle();

                        if (nextApprover) {
                            // Turn on next signer
                            await supabase.from('trinhky_approver').update({ trang_thai: 'DangXuly' }).eq('id', nextApprover.id);
                        } else {
                            // No next signer -> complete document
                            await supabase.from('trinhky_hoso').update({ trang_thai: 'Hoàn thành' }).eq('id', hoso_id);
                        }
                    }

                    return res.status(200).json({ success: true, message: 'Ký duyệt thành công.' });
                }

                if (action_type === 'tu_choi') {
                    if (!comment) {
                        return res.status(400).json({ error: 'Vui lòng cung cấp ý kiến từ chối ký duyệt.' });
                    }

                    // Update current approver
                    await supabase
                        .from('trinhky_approver')
                        .update({
                            trang_thai: 'TuChoi',
                            ngay_ky: now,
                            y_kien: comment
                        })
                        .eq('id', myApproval.id);

                    // Document status goes to rejected
                    await supabase.from('trinhky_hoso').update({ trang_thai: 'Từ chối' }).eq('id', hoso_id);

                    // Insert workflow log
                    await supabase.from('trinhky_workflow').insert({
                        hoso_id,
                        action: 'tu_choi',
                        user_id,
                        comment
                    });

                    return res.status(200).json({ success: true, message: 'Đã từ chối ký duyệt hồ sơ.' });
                }

                if (action_type === 'yeu_cau_chinh_sua') {
                    if (!comment) {
                        return res.status(400).json({ error: 'Vui lòng nhập nội dung yêu cầu chỉnh sửa.' });
                    }

                    // Turn document back to draft or edit state
                    await supabase.from('trinhky_hoso').update({ trang_thai: 'Thu hồi' }).eq('id', hoso_id);
                    await supabase.from('trinhky_approver').update({ trang_thai: 'ChoKy' }).eq('hoso_id', hoso_id);

                    // Insert workflow log
                    await supabase.from('trinhky_workflow').insert({
                        hoso_id,
                        action: 'yeu_cau_chinh_sua',
                        user_id,
                        comment
                    });

                    return res.status(200).json({ success: true, message: 'Đã gửi yêu cầu chỉnh sửa.' });
                }

                if (action_type === 'chuyen_nguoi_ky') {
                    if (!next_user_id) {
                        return res.status(400).json({ error: 'Vui lòng chọn người nhận bàn giao chuyển ký.' });
                    }

                    // Update current approver
                    await supabase
                        .from('trinhky_approver')
                        .update({
                            trang_thai: 'DaChuyen',
                            ngay_ky: now,
                            y_kien: `Chuyển người ký cho nhân viên mới. Ghi chú: ${comment || 'N/A'}`
                        })
                        .eq('id', myApproval.id);

                    // Update approver reference to the new user and set status to active
                    await supabase
                        .from('trinhky_approver')
                        .insert({
                            id: randomUUID(),
                            hoso_id,
                            user_id: next_user_id,
                            thu_tu_ky: myApproval.thu_tu_ky,
                            trang_thai: 'DangXuly'
                        });

                    // Insert workflow log
                    await supabase.from('trinhky_workflow').insert({
                        hoso_id,
                        action: 'chuyen_nguoi_ky',
                        user_id,
                        comment: `Chuyển người ký từ tài khoản hiện tại. Ghi chú: ${comment || 'Không có'}`
                    });

                    return res.status(200).json({ success: true, message: 'Đã chuyển tiếp người ký thành công.' });
                }
            }

            // ACTION: GET DASHBOARD / REPORT STATS
            if (action === 'stats') {
                const { userId } = payload;
                
                // Fetch stats counts
                const { data: allDocs } = await supabase.from('trinhky_hoso').select('trang_thai, nguoi_tao').eq('is_delete', false);
                
                // Fetch approvals pending for user
                const { data: activeApprovals } = await supabase
                    .from('trinhky_approver')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('trang_thai', 'DangXuly');

                const total_hoso = (allDocs || []).length;
                const total_draft = (allDocs || []).filter(d => d.trang_thai === 'Nháp' || d.trang_thai === 'Thu hồi').length;
                const total_waiting = (activeApprovals || []).length;
                const total_signing = (allDocs || []).filter(d => d.trang_thai === 'Đang ký').length;
                const total_completed = (allDocs || []).filter(d => d.trang_thai === 'Hoàn thành').length;
                const total_rejected = (allDocs || []).filter(d => d.trang_thai === 'Từ chối').length;

                return res.status(200).json({
                    total_hoso,
                    total_draft,
                    total_waiting,
                    total_signing,
                    total_completed,
                    total_rejected
                });
            }

            return res.status(400).json({ error: 'Action not supported' });
        }

        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (err: any) {
        console.error('API TrinhKy Error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
