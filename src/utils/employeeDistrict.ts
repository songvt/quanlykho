type EmployeeLookup = {
    id?: string;
    full_name?: string;
    email?: string;
    district?: string;
};

type InspectionEmployee = {
    id: string;
    name: string;
    email?: string;
    district?: string;
};

const normalize = (value?: string) => value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi') || '';

export const resolveEmployeeDistrict = (employee: InspectionEmployee, accounts: EmployeeLookup[]) => {
    const byId = accounts.find(account => account.id === employee.id);
    const byEmail = employee.email ? accounts.find(account => normalize(account.email) === normalize(employee.email)) : undefined;
    const byName = accounts.find(account => normalize(account.full_name) === normalize(employee.name));
    return employee.district?.trim() || byId?.district?.trim() || byEmail?.district?.trim() || byName?.district?.trim() || '-';
};
