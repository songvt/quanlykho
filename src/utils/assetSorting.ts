import type { Asset } from '../types';

const vietnameseCollator = new Intl.Collator('vi', {
    sensitivity: 'base',
    numeric: true,
});

/**
 * Keeps every asset output consistent: asset name first, then its user.
 * Asset code is used only as a deterministic tie-breaker.
 */
export const sortAssetsByNameAndUser = <T extends Pick<Asset, 'asset_name' | 'user_employee_name' | 'asset_code'>>(
    assets: readonly T[],
): T[] => [...assets].sort((left, right) => {
    const nameComparison = vietnameseCollator.compare(left.asset_name || '', right.asset_name || '');
    if (nameComparison !== 0) return nameComparison;

    const userComparison = vietnameseCollator.compare(left.user_employee_name || '', right.user_employee_name || '');
    if (userComparison !== 0) return userComparison;

    return vietnameseCollator.compare(left.asset_code || '', right.asset_code || '');
});
