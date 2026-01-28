export const TARGET_URL = "https://app.hibob.com/";

export const TARGET_URL_HINT = new URL(TARGET_URL).host;

export const isSupportedUrl = (url?: string | null): boolean => {
    if (!url) return false;
    return url.startsWith(TARGET_URL);
};
