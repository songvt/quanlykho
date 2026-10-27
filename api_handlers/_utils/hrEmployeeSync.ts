export const CDBR_TECHNICAL_UNIT = 'Lực lượng kỹ thuật CĐBR Bắc Sài Gòn';

type HRProfileForEmployeeSync = {
    id?: unknown;
    full_name?: unknown;
    email?: unknown;
    phone_number?: unknown;
    department?: unknown;
};

export function buildCDBREmployeeAccounts(
    profiles: HRProfileForEmployeeSync[],
    existingEmails: Set<string>,
) {
    const newEmails = new Set<string>();

    return profiles.flatMap(profile => {
        if (String(profile.department ?? '').trim() !== CDBR_TECHNICAL_UNIT) return [];

        const email = String(profile.email ?? '').trim().toLowerCase();
        const username = String(profile.id ?? '').trim();
        const fullName = String(profile.full_name ?? '').trim();
        if (!email || !username || !fullName || existingEmails.has(email) || newEmails.has(email)) return [];

        newEmails.add(email);
        return [{
            username,
            full_name: fullName,
            email,
            phone_number: String(profile.phone_number ?? '').trim(),
            role: 'staff',
            password: '123456',
            must_change_password: true,
            permissions: '[]',
        }];
    });
}
