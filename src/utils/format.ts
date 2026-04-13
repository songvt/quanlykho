export const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0';
    return new Intl.NumberFormat('vi-VN', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export const getLocalYYYYMMDD = (dateStr?: string | Date): string => {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export const matchDistrict = (search: string, config: string): boolean => {
    if (!search || !config) return false;
    
    const normalize = (s: string) => {
        let text = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
        text = text.replace(/\s+/g, '').replace(/quan/g, 'q').replace(/huyen/g, 'h');
        
        // map common acronyms for standardizing comparisons
        const dict: Record<string, string> = {
            'hmn': 'hhocmon',
            'hocmon': 'hhocmon',
            'cci': 'hcuchi',
            'cuchi': 'hcuchi',
            'bch': 'hbinhchanh',
            'binhchanh': 'hbinhchanh',
            'nbe': 'hnhabe',
            'nhabe': 'hnhabe',
            'cgo': 'hcangio',
            'cangio': 'hcangio',
        };
        return dict[text] || text;
    };

    const nSearch = normalize(search);
    const nConfig = normalize(config);
    
    return nSearch === nConfig || nSearch.includes(nConfig) || nConfig.includes(nSearch);
};
