import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'employees');

        if (sheet.rowCount === 0) {
            await sheet.setHeaderRow([
                'id', 'auth_user_id', 'full_name', 'role', 'email', 'permissions', 'created_at', 'username', 'password', 'must_change_password', 'phone_number', 'district'
            ]);
        }

        switch (req.method) {
            case 'GET': {
                const { email, password } = req.query;

                const rows = await sheet.getRows();

                // Login scenario
                if (email && password) {
                    const userRow = rows.find(r =>
                        r.get('email') === email && r.get('password') === password
                    );

                    if (!userRow) {
                        return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
                    }

                    const user = userRow.toObject();
                    // Parse permissions back to array if stored as string
                    if (user.permissions && typeof user.permissions === 'string') {
                        try {
                            user.permissions = JSON.parse(user.permissions);
                        } catch (e) {
                            user.permissions = user.permissions.split(',').map((p: string) => p.trim()).filter(Boolean);
                        }
                    } else if (!Array.isArray(user.permissions)) {
                        user.permissions = [];
                    }

                    return res.status(200).json(user);
                }

                // Fetch all scenario
                const employees = rows.map(row => {
                    const obj = row.toObject();
                    // Don't send passwords back to the client unnecessarily
                    delete obj.password;
                    if (obj.permissions && typeof obj.permissions === 'string') {
                        try {
                            obj.permissions = JSON.parse(obj.permissions);
                        } catch (e) {
                            obj.permissions = obj.permissions.split(',').map((p: string) => p.trim()).filter(Boolean);
                        }
                    } else if (!Array.isArray(obj.permissions)) {
                        obj.permissions = [];
                    }
                    return obj;
                });
                return res.status(200).json(employees);
            }

            case 'POST': {
                const { action, payload } = req.body;

                if (action === 'bulk_insert') {
                    if (!Array.isArray(payload)) return res.status(400).json({ error: 'Payload must be an array' });

                    const toInsert = payload.map(p => ({
                        ...p,
                        permissions: p.permissions ? JSON.stringify(p.permissions) : '[]'
                    }));

                    const rowsAdded = await sheet.addRows(toInsert);
                    const result = rowsAdded.map(r => {
                        const obj = r.toObject();
                        if (obj.permissions && typeof obj.permissions === 'string') {
                            try { obj.permissions = JSON.parse(obj.permissions); }
                            catch (e) { obj.permissions = obj.permissions.split(',').map((p: string) => p.trim()).filter(Boolean); }
                        } else if (!Array.isArray(obj.permissions)) {
                            obj.permissions = [];
                        }
                        return obj;
                    });
                    return res.status(201).json(result);
                } else {
                    const toInsert = {
                        ...payload,
                        permissions: payload.permissions ? JSON.stringify(payload.permissions) : '[]'
                    };
                    const newRow = await sheet.addRow(toInsert);

                    const result = newRow.toObject();
                    if (result.permissions && typeof result.permissions === 'string') {
                        try { result.permissions = JSON.parse(result.permissions); }
                        catch (e) { result.permissions = result.permissions.split(',').map((p: string) => p.trim()).filter(Boolean); }
                    } else if (!Array.isArray(result.permissions)) {
                        result.permissions = [];
                    }

                    return res.status(201).json(result);
                }
            }

            case 'PUT': {
                // Update employee or change password
                const updatedEmployee = req.body;
                if (!updatedEmployee.id) {
                    return res.status(400).json({ error: 'Employee ID is required' });
                }

                const rows = await sheet.getRows();
                const rowToUpdate = rows.find(row => row.get('id') === updatedEmployee.id);

                if (!rowToUpdate) {
                    return res.status(404).json({ error: 'Employee not found' });
                }

                const dataToSave = { ...updatedEmployee };
                if (dataToSave.permissions && Array.isArray(dataToSave.permissions)) {
                    dataToSave.permissions = JSON.stringify(dataToSave.permissions);
                }

                rowToUpdate.assign(dataToSave);
                await rowToUpdate.save();

                const result = rowToUpdate.toObject();
                delete result.password; // Omit password in response

                if (result.permissions && typeof result.permissions === 'string') {
                    try {
                        result.permissions = JSON.parse(result.permissions);
                    } catch (e) {
                        result.permissions = result.permissions.split(',').map((p: string) => p.trim()).filter(Boolean);
                    }
                } else if (!Array.isArray(result.permissions)) {
                    result.permissions = [];
                }

                return res.status(200).json(result);
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const rows = await sheet.getRows();
                let deletedIds: string[] = [];

                if (ids && Array.isArray(ids)) {
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (ids.includes(rows[i].get('id'))) {
                            await rows[i].delete();
                            deletedIds.push(rows[i].get('id'));
                        }
                    }
                } else if (id) {
                    const rowToDelete = rows.find(row => row.get('id') === id);
                    if (rowToDelete) {
                        await rowToDelete.delete();
                        deletedIds.push(id);
                    } else {
                        return res.status(404).json({ error: 'Employee not found' });
                    }
                }
                return res.status(200).json({ message: 'Deleted successfully', ids: deletedIds });
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Employees):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
