import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';
import RSS from 'rss';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(relativeTime);

const isYouTubeChannelId = (id: string) => /^UC[\w-]{21}[AQgw]$/.test(id);

const parseRelativeDate = (dateStr: string) => {
    // Basic "ago" parsing for English
    if (dateStr.includes('ago')) {
        const value = parseInt(dateStr.match(/\d+/)?.[0] || '0');
        if (dateStr.includes('second')) return dayjs().subtract(value, 'second').toDate();
        if (dateStr.includes('minute')) return dayjs().subtract(value, 'minute').toDate();
        if (dateStr.includes('hour')) return dayjs().subtract(value, 'hour').toDate();
        if (dateStr.includes('day')) return dayjs().subtract(value, 'day').toDate();
        if (dateStr.includes('week')) return dayjs().subtract(value, 'week').toDate();
        if (dateStr.includes('month')) return dayjs().subtract(value, 'month').toDate();
        if (dateStr.includes('year')) return dayjs().subtract(value, 'year').toDate();
    }
    return new Date(); // Fallback
};

const renderCommunityDescription = (runs: any[], media: any[]) => {
    let text = '';
    if (runs && runs.length) {
        runs.forEach((run: any) => {
            text += (run?.text ?? '');
        });
    }
    // Optional: Add media links or indicators if desired, but user asked for "clean text"
    // matching the example which had no tags.
    return text;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { handle } = req.query;

    if (!handle || typeof handle !== 'string') {
        return res.status(400).json({ error: 'Missing handle parameter. Usage: /?handle=@YourHandle' });
    }

    let urlPath = handle;
    if (isYouTubeChannelId(handle)) {
        urlPath = `channel/${handle}`;
    }

    const targetUrl = `https://www.youtube.com/${urlPath}/posts`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch YouTube page: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const scriptContent = $('script')
            .filter((_, script) => {
                const text = $(script).text();
                return text.includes('ytInitialData =');
            })
            .text();

        const match = scriptContent.match(/ytInitialData = ({.*?});/);

        if (!match) {
            console.error('Script content sample:', scriptContent.substring(0, 100));
            throw new Error('Could not find ytInitialData in the page.');
        }

        const ytInitialData = JSON.parse(match[1]);

        // Navigate safely to the content
        // Navigate safely to the content
        let username, channelUrl, description;
        const microformat = ytInitialData.microformat?.microformatDataRenderer;

        if (microformat) {
            username = microformat.title;
            channelUrl = microformat.urlCanonical || `https://www.youtube.com/${urlPath}`;
            description = microformat.description;
        } else {
            const channelMetadata = ytInitialData.metadata?.channelMetadataRenderer;
            if (channelMetadata) {
                username = channelMetadata.title;
                channelUrl = channelMetadata.channelUrl;
                description = channelMetadata.description;
            }
        }

        if (!username) {
            throw new Error('Could not find channel metadata. Is the handle correct?');
        }

        const tabs = ytInitialData.contents?.twoColumnBrowseResultsRenderer?.tabs;
        let communityTab = tabs?.find(
            (tab: any) => tab.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url?.endsWith('/community') ||
                tab.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url?.endsWith('/posts')
        );

        // Fallback: Check if the first tab has content if we couldn't find it by URL
        if (!communityTab && tabs && tabs.length > 0) {
            const firstTabContent = tabs[0].tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
            // Check if it looks like a community tab (has backstage posts)
            if (firstTabContent && firstTabContent.some((i: any) => i.backstagePostThreadRenderer)) {
                communityTab = tabs[0];
            }
        }

        if (!communityTab) {
            throw new Error('Community tab not found. Does this channel have a community tab?');
        }

        const contents = communityTab.tabRenderer.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

        if (!contents) {
            // It might be empty or differently structured
            throw new Error('No community posts found.');
        }

        // Check for empty state message
        if (contents[0].messageRenderer) {
            throw new Error(`YouTube: ${contents[0].messageRenderer.text.runs[0].text}`);
        }

        const items = contents
            .filter((i: any) => i.backstagePostThreadRenderer)
            .map((item: any) => {
                const thread = item.backstagePostThreadRenderer;
                const post = thread.post.backstagePostRenderer || thread.post.sharedPostRenderer?.originalPost?.backstagePostRenderer;

                if (!post) return null;

                const media = post.backstageAttachment?.postMultiImageRenderer?.images.map((i: any) => i.backstageImageRenderer.image.thumbnails.pop())
                    ?? (post.backstageAttachment?.backstageImageRenderer ? [post.backstageAttachment.backstageImageRenderer.image.thumbnails.pop()] : []);

                const contentRuns = post.contentText?.runs || [];
                const postText = contentRuns.map((r: any) => r.text).join('');
                const postId = post.postId;
                const author = post.authorText?.runs?.[0]?.text || username;
                const publishedTimeText = post.publishedTimeText?.runs?.[0]?.text || '';

                return {
                    title: postText.substring(0, 50) + (postText.length > 50 ? '...' : ''),
                    description: renderCommunityDescription(contentRuns, media),
                    url: `https://www.youtube.com/post/${postId}`,
                    guid: postId,
                    author: author,
                    date: parseRelativeDate(publishedTimeText),
                };
            })
            .filter((item: any) => item !== null);

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

        let rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>${escapeXml(username + ' - Community Posts')}</title>
    <description>${escapeXml(description)}</description>
    <link>${channelUrl}</link>
    <generator>RSS for Node</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://${req.headers.host}${req.url}" rel="self" type="application/rss+xml"/>
`;

        items.forEach((item: any) => {
            rssXml += `    <item>
        <title>${escapeXml(item.title)}</title>
        <description>${escapeXml(item.description)}</description>
        <link>${item.url}</link>
        <guid isPermaLink="false">${item.guid}</guid>
        <dc:creator>${escapeXml(item.author)}</dc:creator>
        <pubDate>${item.date.toUTCString()}</pubDate>
    </item>
`;
        });

        rssXml += `</channel>
</rss>`;

        res.setHeader('Content-Type', 'text/xml');
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=30');
        res.status(200).send(rssXml);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}
