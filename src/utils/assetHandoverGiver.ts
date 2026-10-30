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
