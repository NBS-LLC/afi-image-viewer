// utils.js

function parseSizeToBytes(sizeString) {
    if (!sizeString || sizeString.trim() === '-' || sizeString.trim() === '') {
        return 0; // Or handle as an unknown/default small size
    }
    const s = sizeString.trim().toUpperCase();
    const numericValue = parseFloat(s);

    if (s.endsWith('K')) {
        return numericValue * 1024;
    } else if (s.endsWith('M')) {
        return numericValue * 1024 * 1024;
    } else if (s.endsWith('G')) {
        return numericValue * 1024 * 1024 * 1024;
    }
    return numericValue; // Assume bytes if no unit
}

window.parseSizeToBytes = parseSizeToBytes;
