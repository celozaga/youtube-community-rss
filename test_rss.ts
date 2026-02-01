
import RSS from 'rss';

const feed = new RSS({
    title: 'Test Feed',
    description: 'Test Description',
    feed_url: 'http://example.com/rss',
    site_url: 'http://example.com',
    cdata: false // Hypothesis: This disables CDATA globally
});

feed.item({
    title: 'Test Item 2',
    description: 'Desc 2',
    url: 'http://example.com/post/2',
    date: new Date()
});

// Try to hack it using XML characters directly if possible or checking if there is another way
// Actually, let's try to see if just passing basic string without special chars avoids it?
feed.item({
    title: 'CleanTitle',
    description: 'CleanDescription',
    url: 'http://example.com/post/3',
    date: new Date()
});

console.log(feed.xml({ indent: true }));
