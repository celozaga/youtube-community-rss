
import * as cheerio from 'cheerio';

const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
        return c;
    });
};

const generateRSS = (data: any) => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>${escapeXml(data.title)}</title>
    <description>${escapeXml(data.description)}</description>
    <link>${data.site_url}</link>
    <atom:link href="${data.feed_url}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;

    data.items.forEach((item: any) => {
        xml += `    <item>
        <title>${escapeXml(item.title)}</title>
        <description>${escapeXml(item.description)}</description>
        <link>${item.url}</link>
        <guid isPermaLink="false">${item.guid}</guid>
        <dc:creator>${escapeXml(item.author)}</dc:creator>
        <pubDate>${item.date.toUTCString()}</pubDate>
    </item>
`;
    });

    xml += `</channel>
</rss>`;
    return xml;
};

// Test
const feed = generateRSS({
    title: 'Test Feed & > <',
    description: 'Desc with "quotes"',
    site_url: 'http://example.com',
    feed_url: 'http://example.com/feed',
    items: [
        {
            title: 'Post 1 & < >',
            description: 'Desc 1',
            url: 'http://example.com/1',
            guid: '1',
            author: 'Me',
            date: new Date()
        }
    ]
});

console.log(feed);
