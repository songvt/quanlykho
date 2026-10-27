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
