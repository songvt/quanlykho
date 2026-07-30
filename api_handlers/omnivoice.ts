import { VercelRequest, VercelResponse } from '@vercel/node';
import { spawn, exec } from 'child_process';

let omniProcess: any = null;
let omniLog: string[] = [];

// Helper to check if the Gradio server is responding
async function isServerResponding(port: number): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const res = await fetch(`http://127.0.0.1:${port}`, {
            method: 'HEAD',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return res.ok || res.status < 500;
    } catch {
        return false;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { type } = req.query;

    if (req.method === 'GET') {
        if (type === 'status') {
            const isResponding = await isServerResponding(8001);
            const isProcessRunning = omniProcess !== null && omniProcess.exitCode === null;

            return res.status(200).json({
                running: isResponding || isProcessRunning,
                pid: omniProcess ? omniProcess.pid : null,
                isResponding,
                isProcessRunning,
                logs: omniLog.slice(-50)
            });
        }

        return res.status(400).json({ error: 'Invalid GET type parameter' });
    }

    if (req.method === 'POST') {
        if (type === 'start') {
            const isResponding = await isServerResponding(8001);
            const isProcessRunning = omniProcess !== null && omniProcess.exitCode === null;

            if (isResponding || isProcessRunning) {
                return res.status(200).json({
                    success: true,
                    message: 'Server OmniVoice đang hoạt động',
                    pid: omniProcess ? omniProcess.pid : 'unknown'
                });
            }

            omniLog = [];
            omniLog.push(`[${new Date().toLocaleString()}] [SYSTEM] Khởi động server OmniVoice...`);

            try {
                // Set PYTHONUNBUFFERED=1 to get instant log updates
                const env = { 
                    ...process.env, 
                    PYTHONUNBUFFERED: '1'
                };

                // Spawn the omnivoice-demo process using absolute path
                const exePath = 'C:\\Users\\Songvt\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\omnivoice-demo.exe';
                omniProcess = spawn(exePath, ['--ip', '127.0.0.1', '--port', '8001'], {
                    env
                });

                if (omniProcess.pid) {
                    omniLog.push(`[${new Date().toLocaleString()}] [SYSTEM] Đã khởi tạo tiến trình với PID: ${omniProcess.pid}`);
                }

                omniProcess.stdout.on('data', (data: any) => {
                    const lines = data.toString().split('\n');
                    lines.forEach((line: string) => {
                        const trimmed = line.trim();
                        if (trimmed) {
                            omniLog.push(`[${new Date().toLocaleTimeString()}] [STDOUT] ${trimmed}`);
                        }
                    });
                    if (omniLog.length > 500) {
                        omniLog = omniLog.slice(-200);
                    }
                });

                omniProcess.stderr.on('data', (data: any) => {
                    const lines = data.toString().split('\n');
                    lines.forEach((line: string) => {
                        const trimmed = line.trim();
                        if (trimmed) {
                            omniLog.push(`[${new Date().toLocaleTimeString()}] [STDERR] ${trimmed}`);
                        }
                    });
                    if (omniLog.length > 500) {
                        omniLog = omniLog.slice(-200);
                    }
                });

                omniProcess.on('exit', (code: number | null, signal: string | null) => {
                    omniLog.push(`[${new Date().toLocaleString()}] [SYSTEM] Tiến trình OmniVoice đã dừng. ExitCode: ${code}, Signal: ${signal}`);
                    omniProcess = null;
                });

                omniProcess.on('error', (err: any) => {
                    omniLog.push(`[${new Date().toLocaleString()}] [SYSTEM] Tiến trình gặp lỗi: ${err.message}`);
                });

                return res.status(200).json({
                    success: true,
                    message: 'Đang khởi động Server OmniVoice...',
                    pid: omniProcess.pid
                });
            } catch (err: any) {
                console.error('Lỗi khi spawn omnivoice-demo:', err);
                omniLog.push(`[SYSTEM] Lỗi spawn: ${err.message}`);
                return res.status(500).json({ error: 'Không thể khởi động server OmniVoice', details: err.message });
            }
        }

        if (type === 'stop') {
            if (!omniProcess) {
                // If there's no process reference but port 8001 is active, we can try to force kill any process using 8001
                const isResponding = await isServerResponding(8001);
                if (isResponding) {
                    omniLog.push(`[SYSTEM] Phát hiện port 8001 đang hoạt động, tiến hành giải phóng cổng...`);
                    exec('netstat -ano | findstr :8001', (err, stdout) => {
                        if (!err && stdout) {
                            const lines = stdout.split('\n');
                            const pids = lines.map(line => {
                                const parts = line.trim().split(/\s+/);
                                return parts[parts.length - 1];
                            }).filter(pid => pid && pid !== '0' && !isNaN(Number(pid)));

                            const uniquePids = Array.from(new Set(pids));
                            uniquePids.forEach(pid => {
                                exec(`taskkill /pid ${pid} /f /t`);
                            });
                        }
                    });
                    return res.status(200).json({ success: true, message: 'Đang giải phóng cổng 8001...' });
                }

                return res.status(200).json({ success: true, message: 'Server đã dừng sẵn' });
            }

            const pid = omniProcess.pid;
            omniLog.push(`[${new Date().toLocaleString()}] [SYSTEM] Gửi tín hiệu dừng đến tiến trình (PID: ${pid})...`);
            
            // On Windows, taskkill tree-kill is safer
            exec(`taskkill /pid ${pid} /f /t`, (err, stdout, stderr) => {
                if (err) {
                    omniLog.push(`[SYSTEM] Lỗi khi taskkill: ${err.message}`);
                    // Fallback to process.kill if taskkill fails
                    try {
                        omniProcess.kill('SIGKILL');
                    } catch (killErr: any) {
                        omniLog.push(`[SYSTEM] Lỗi SIGKILL: ${killErr.message}`);
                    }
                } else {
                    omniLog.push(`[SYSTEM] Đã dừng server thành công.`);
                }
                omniProcess = null;
            });

            return res.status(200).json({ success: true, message: 'Đang dừng server OmniVoice...' });
        }

        return res.status(400).json({ error: 'Invalid POST type parameter' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
