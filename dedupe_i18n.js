const fs = require('fs');

const content = fs.readFileSync('/src/i18n.ts', 'utf8');

// The file is a TypeScript file exporting an object.
// We can't easily parse it as JSON.
// But we can find the blocks for each language.

function deduplicateSection(section) {
    const lines = section.split('\n');
    const seen = new Set();
    const result = [];
    for (const line of lines) {
        const match = line.match(/^\s*(\w+):/);
        if (match) {
            const key = match[1];
            if (seen.has(key)) {
                console.log(`Removing duplicate key: ${key}`);
                continue;
            }
            seen.add(key);
        }
        result.push(line);
    }
    return result.join('\n');
}

// Very rough split by language markers
const parts = content.split(/(az: \{|en: \{|ru: \{)/);
let newContent = '';

for (let i = 0; i < parts.length; i++) {
    if (parts[i].match(/^(az: \{|en: \{|ru: \{)$/)) {
        newContent += parts[i];
        let sectionContent = parts[i+1];
        // Deduplicate until the next language or end of object
        // Actually parts[i+1] contains everything until the next match
        newContent += deduplicateSection(sectionContent);
        i++;
    } else if (i === 0 || !parts[i-1].match(/^(az: \{|en: \{|ru: \{)$/)) {
        newContent += parts[i];
    }
}

fs.writeFileSync('/src/i18n.ts', newContent);
console.log('Deduplication complete.');
