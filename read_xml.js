import fs from 'fs';
import path from 'path';

const xmlPath = path.join('temp_docx', 'word', 'document.xml');

try {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  // Match <w:t>...</w:t> tags
  // w:t tags contain the actual text in Word document XML
  const matches = xml.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
  
  const text = matches
    .map(match => {
      const content = match.replace(/<w:t[^>]*>/, '').replace('</w:t>', '');
      // Decode simple XML entities
      return content
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    })
    .join(' ');

  // Clean up excessive spaces but keep some structure
  // Let's also split paragraphs. In Word XML, <w:p> indicates paragraph tags.
  // Let's do a better parsing that handles paragraphs <w:p> to put newlines!
  
  const paragraphs = xml.split(/<w:p\b[^>]*>/);
  const formattedText = paragraphs.map(p => {
    const tMatches = p.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
    return tMatches.map(match => {
      const content = match.replace(/<w:t[^>]*>/, '').replace('</w:t>', '');
      return content
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }).join('');
  }).filter(line => line.trim().length > 0).join('\n\n');

  fs.writeFileSync('functional_spec.txt', formattedText, 'utf8');
  console.log('Successfully wrote functional_spec.txt!');
} catch (err) {
  console.error('Error reading/parsing XML:', err);
}
