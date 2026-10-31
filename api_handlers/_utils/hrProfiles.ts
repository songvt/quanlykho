type HRProfileInput = Record<string, unknown>;

export function prepareHRProfileUpsert(items: HRProfileInput[]) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Không có hồ sơ nhân sự để nhập');
    }

    const importedAt = new Date().toISOString();
    const profilesById = new Map<string, Record<string, unknown>>();

    items.forEach((profile, index) => {
        const row = index + 1;
        const id = String(profile?.id ?? '').trim();
        const fullName = String(profile?.full_name ?? '').trim();

        if (!id) throw new Error(`Dòng ${row}: Mã nhân viên không được để trống`);
        if (!fullName) throw new Error(`Dòng ${row}: Họ và tên không được để trống`);

        profilesById.set(id, {
            id,
            full_name: fullName,
            gender: profile.gender || 'Nam',
            date_of_birth: profile.date_of_birth || null,
            phone_number: profile.phone_number || '',
            email: profile.email || '',
            job_position: profile.job_position || '',
            department: profile.department || '',
            district: profile.district || '',
            probation_date: profile.probation_date || null,
            official_date: profile.official_date || null,
            contract_type: profile.contract_type || '',
            labor_status: profile.labor_status || 'Đang làm việc',
            insurance_participation: profile.insurance_participation || false,
            uniform_size: profile.uniform_size || '',
            shoe_size: profile.shoe_size || '',
            created_at: profile.created_at || importedAt,
        });
    });

    return [...profilesById.values()];
}

export function mergeHRProfiles(
    importedItems: Record<string, unknown>[],
    existingProfiles: Record<string, unknown>[]
) {
    const existingMap = new Map<string, Record<string, unknown>>();
    existingProfiles.forEach(p => {
        const id = String(p.id ?? '').trim();
        if (id) existingMap.set(id, p);
    });

    const fieldsToUpdate = [
        'full_name', 'gender', 'date_of_birth', 'phone_number', 'email',
        'job_position', 'department', 'district', 'probation_date',
        'official_date', 'contract_type', 'labor_status',
        'insurance_participation', 'uniform_size', 'shoe_size'
    ];

    let insertedCount = 0;
    let updatedCount = 0;

    const mergedList = importedItems.map(item => {
        const id = String(item.id ?? '').trim();
        const existing = existingMap.get(id);

        if (existing) {
            // Update existing record: merge changed fields, keep existing created_at
            const updated = { ...existing };
            fieldsToUpdate.forEach(field => {
                const val = item[field];
                if (typeof val === 'boolean') {
                    updated[field] = val;
                } else if (val !== undefined && val !== null && String(val).trim() !== '') {
                    updated[field] = val;
                }
            });
            updatedCount++;
            return updated;
        } else {
            // New record
            insertedCount++;
            return {
                ...item,
                created_at: item.created_at || new Date().toISOString()
            };
        }
    });

    return { mergedList, insertedCount, updatedCount };
}
