import type { HRProfile } from '../types';

const DEFAULT_SECOND_GIVER_NAME = 'TRẦN VIỆT BẮC';

export const getDefaultSecondGiver = (profiles: HRProfile[]) => {
    const defaultGiver = profiles.find((profile) =>
        profile.full_name.trim().toLocaleUpperCase('vi-VN') === DEFAULT_SECOND_GIVER_NAME
    );

    return {
        giverName2: DEFAULT_SECOND_GIVER_NAME,
        giverTitle2: defaultGiver?.job_position || '',
        giverPhone2: defaultGiver?.phone_number || '',
    };
};

export const findGiverProfile = (query: string, profiles: HRProfile[]): HRProfile | undefined => {
    const clean = query.trim().toLowerCase();
    if (!clean) return undefined;
    return profiles.find(
        (p) =>
            (p.full_name || '').trim().toLowerCase() === clean ||
            (p.id || '').trim().toLowerCase() === clean
    );
};

export const filterGiverProfiles = (input: string, profiles: HRProfile[], currentSelectedName = ''): HRProfile[] => {
    const clean = input.trim().toLowerCase();
    const currentClean = currentSelectedName.trim().toLowerCase();
    if (!clean || clean === currentClean) {
        return profiles;
    }
    return profiles.filter((p) =>
        (p.full_name || '').toLowerCase().includes(clean) ||
        (p.id || '').toLowerCase().includes(clean) ||
        (p.job_position || '').toLowerCase().includes(clean) ||
        (p.phone_number || '').includes(clean)
    );
};

