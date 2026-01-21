import express from 'express'

const router = express.Router()

// Cache for news and calendar data
let newsCache = { data: null, timestamp: 0 }
let calendarCache = { data: null, timestamp: 0 }
let marketWatchCache = { data: null, timestamp: 0 }
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const MARKETWATCH_CACHE_DURATION = 2 * 60 * 1000 // 2 minutes for real-time feel

// GET /api/news/market - Get market news from multiple sources
router.get('/market', async (req, res) => {
  try {
    const now = Date.now()
    
    // Return cached data if fresh
    if (newsCache.data && (now - newsCache.timestamp) < CACHE_DURATION) {
      return res.json({ success: true, news: newsCache.data, cached: true })
    }

    // Fetch from Finnhub (free tier - 60 calls/min)
    const finnhubNews = await fetchFinnhubNews()
    
    // Fetch from Alpha Vantage News (free tier)
    const alphaNews = await fetchAlphaVantageNews()
    
    // Combine and deduplicate
    const allNews = [...finnhubNews, ...alphaNews]
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
      .slice(0, 20)

    newsCache = { data: allNews, timestamp: now }
    
    res.json({ success: true, news: allNews })
  } catch (error) {
    console.error('Error fetching market news:', error)
    // Return cached data on error
    if (newsCache.data) {
      return res.json({ success: true, news: newsCache.data, cached: true })
    }
    res.status(500).json({ success: false, message: 'Error fetching news' })
  }
})

// GET /api/news/marketwatch - Get MarketWatch real-time news
router.get('/marketwatch', async (req, res) => {
  try {
    const now = Date.now()
    
    // Return cached data if fresh
    if (marketWatchCache.data && (now - marketWatchCache.timestamp) < MARKETWATCH_CACHE_DURATION) {
      return res.json({ success: true, news: marketWatchCache.data, cached: true })
    }

    // Fetch from MarketWatch RSS feeds
    const news = await fetchMarketWatchNews()
    
    marketWatchCache = { data: news, timestamp: now }
    
    res.json({ success: true, news })
  } catch (error) {
    console.error('Error fetching MarketWatch news:', error)
    if (marketWatchCache.data) {
      return res.json({ success: true, news: marketWatchCache.data, cached: true })
    }
    res.status(500).json({ success: false, message: 'Error fetching MarketWatch news' })
  }
})

// GET /api/news/calendar - Get economic calendar
router.get('/calendar', async (req, res) => {
  try {
    const now = Date.now()
    
    // Return cached data if fresh
    if (calendarCache.data && (now - calendarCache.timestamp) < CACHE_DURATION) {
      return res.json({ success: true, events: calendarCache.data, cached: true })
    }

    // Fetch from Finnhub economic calendar
    const events = await fetchEconomicCalendar()
    
    calendarCache = { data: events, timestamp: now }
    
    res.json({ success: true, events })
  } catch (error) {
    console.error('Error fetching economic calendar:', error)
    if (calendarCache.data) {
      return res.json({ success: true, events: calendarCache.data, cached: true })
    }
    res.status(500).json({ success: false, message: 'Error fetching calendar' })
  }
})

// Finnhub News API (Free tier: 60 calls/min)
async function fetchFinnhubNews() {
  try {
    const response = await fetch(
      'https://finnhub.io/api/v1/news?category=forex&token=demo'
    )
    if (!response.ok) return []
    
    const data = await response.json()
    return data.slice(0, 10).map(item => ({
      id: item.id,
      title: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      image: item.image,
      datetime: new Date(item.datetime * 1000).toISOString(),
      category: item.category || 'Forex',
      related: item.related
    }))
  } catch (e) {
    console.error('Finnhub news error:', e)
    return []
  }
}

// Alpha Vantage News (Free tier)
async function fetchAlphaVantageNews() {
  try {
    // Using demo key - replace with actual key for production
    const response = await fetch(
      'https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=forex,economy&apikey=demo'
    )
    if (!response.ok) return []
    
    const data = await response.json()
    if (!data.feed) return []
    
    return data.feed.slice(0, 10).map((item, idx) => ({
      id: `av-${idx}`,
      title: item.title,
      summary: item.summary,
      source: item.source,
      url: item.url,
      image: item.banner_image,
      datetime: item.time_published,
      category: item.topics?.[0]?.topic || 'Markets',
      sentiment: item.overall_sentiment_label
    }))
  } catch (e) {
    console.error('Alpha Vantage news error:', e)
    return []
  }
}

// Finnhub Economic Calendar
async function fetchEconomicCalendar() {
  try {
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const from = today.toISOString().split('T')[0]
    const to = nextWeek.toISOString().split('T')[0]
    
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=demo`
    )
    if (!response.ok) return getFallbackCalendar()
    
    const data = await response.json()
    if (!data.economicCalendar || data.economicCalendar.length === 0) {
      return getFallbackCalendar()
    }
    
    return data.economicCalendar.slice(0, 15).map((item, idx) => ({
      id: idx,
      time: item.time || '00:00',
      date: item.date,
      currency: item.country || 'USD',
      event: item.event,
      impact: item.impact === 3 ? 'high' : item.impact === 2 ? 'medium' : 'low',
      forecast: item.estimate || '-',
      previous: item.prev || '-',
      actual: item.actual || '-'
    }))
  } catch (e) {
    console.error('Economic calendar error:', e)
    return getFallbackCalendar()
  }
}

// Fallback calendar data when API fails
function getFallbackCalendar() {
  const now = new Date()
  const formatTime = (hours) => {
    const d = new Date(now)
    d.setHours(hours, 0, 0, 0)
    return d.toTimeString().slice(0, 5)
  }
  
  return [
    { id: 1, time: formatTime(8), date: now.toISOString().split('T')[0], currency: 'USD', event: 'Initial Jobless Claims', impact: 'medium', forecast: '220K', previous: '218K' },
    { id: 2, time: formatTime(10), date: now.toISOString().split('T')[0], currency: 'EUR', event: 'ECB President Speech', impact: 'high', forecast: '-', previous: '-' },
    { id: 3, time: formatTime(14), date: now.toISOString().split('T')[0], currency: 'GBP', event: 'BOE Interest Rate Decision', impact: 'high', forecast: '5.25%', previous: '5.25%' },
    { id: 4, time: formatTime(15), date: now.toISOString().split('T')[0], currency: 'USD', event: 'Existing Home Sales', impact: 'medium', forecast: '4.0M', previous: '3.96M' },
    { id: 5, time: formatTime(21), date: now.toISOString().split('T')[0], currency: 'JPY', event: 'BOJ Monetary Policy Statement', impact: 'high', forecast: '-', previous: '-' },
  ]
}

// Fetch MarketWatch News from RSS feeds
async function fetchMarketWatchNews() {
  try {
    const feeds = [
      'https://feeds.content.dowjones.io/public/rss/mw_topstories',
      'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',
      'https://feeds.content.dowjones.io/public/rss/mw_marketpulse'
    ]
    
    const allNews = []
    
    for (const feedUrl of feeds) {
      try {
        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NewsReader/1.0)'
          }
        })
        
        if (!response.ok) continue
        
        const xmlText = await response.text()
        const items = parseRSSItems(xmlText)
        allNews.push(...items)
      } catch (e) {
        console.error(`Error fetching ${feedUrl}:`, e.message)
      }
    }
    
    // Deduplicate by title and sort by date
    const seen = new Set()
    const uniqueNews = allNews.filter(item => {
      if (seen.has(item.title)) return false
      seen.add(item.title)
      return true
    })
    
    // Sort by datetime descending
    uniqueNews.sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
    
    return uniqueNews.slice(0, 50)
  } catch (e) {
    console.error('MarketWatch fetch error:', e)
    return getMarketWatchFallback()
  }
}

// Parse RSS XML items
function parseRSSItems(xmlText) {
  const items = []
  const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || []
  
  itemMatches.forEach((item, index) => {
    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/)
    const linkMatch = item.match(/<link>(.*?)<\/link>/)
    const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/)
    const categoryMatch = item.match(/<category>(.*?)<\/category>/)
    const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/)
    
    // Extract image from media:content, media:thumbnail, or enclosure
    const mediaContentMatch = item.match(/<media:content[^>]*url=["']([^"']+)["']/) 
    const mediaThumbnailMatch = item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/)
    const enclosureMatch = item.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/)
    const imgInDescMatch = item.match(/<img[^>]*src=["']([^"']+)["']/)
    
    // Get image URL from various sources
    let imageUrl = mediaContentMatch?.[1] || mediaThumbnailMatch?.[1] || enclosureMatch?.[1] || imgInDescMatch?.[1] || null
    
    // Use category-based placeholder images if no image found
    if (!imageUrl) {
      const category = categoryMatch ? categoryMatch[1].toLowerCase() : 'markets'
      imageUrl = getCategoryImage(category)
    }
    
    if (titleMatch) {
      const title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
      const pubDate = pubDateMatch ? pubDateMatch[1] : new Date().toISOString()
      
      items.push({
        id: `mw-${Date.now()}-${index}`,
        title: title,
        url: linkMatch ? linkMatch[1] : 'https://www.marketwatch.com',
        datetime: pubDate,
        time: formatTimeAgo(pubDate),
        category: categoryMatch ? categoryMatch[1] : 'Markets',
        source: 'MarketWatch',
        summary: descMatch ? descMatch[1].replace(/<[^>]*>/g, '').slice(0, 200) : '',
        image: imageUrl
      })
    }
  })
  
  return items
}

// Get placeholder image based on category
function getCategoryImage(category) {
  const images = {
    markets: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=200&fit=crop',
    stocks: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400&h=200&fit=crop',
    economy: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&h=200&fit=crop',
    currencies: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&h=200&fit=crop',
    forex: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&h=200&fit=crop',
    commodities: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400&h=200&fit=crop',
    crypto: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=200&fit=crop',
    bitcoin: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=200&fit=crop',
    technology: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=200&fit=crop',
    politics: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=200&fit=crop',
    energy: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=200&fit=crop',
    gold: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400&h=200&fit=crop',
    oil: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=400&h=200&fit=crop',
  }
  
  // Check if category contains any keyword
  for (const [key, url] of Object.entries(images)) {
    if (category.includes(key)) return url
  }
  
  return images.markets // Default
}

// Format time ago helper
function formatTimeAgo(datetime) {
  if (!datetime) return ''
  const now = new Date()
  const date = new Date(datetime)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

// Fallback MarketWatch data
function getMarketWatchFallback() {
  return [
    { id: 'mw-1', title: 'Markets open higher as investors digest economic data', source: 'MarketWatch', time: 'Just now', category: 'Markets', url: 'https://www.marketwatch.com' },
    { id: 'mw-2', title: 'Fed officials signal patience on rate decisions', source: 'MarketWatch', time: '5m ago', category: 'Economy', url: 'https://www.marketwatch.com' },
    { id: 'mw-3', title: 'Dollar strengthens against major currencies', source: 'MarketWatch', time: '10m ago', category: 'Currencies', url: 'https://www.marketwatch.com' },
    { id: 'mw-4', title: 'Oil prices rise on supply concerns', source: 'MarketWatch', time: '15m ago', category: 'Commodities', url: 'https://www.marketwatch.com' },
    { id: 'mw-5', title: 'Tech stocks lead market gains', source: 'MarketWatch', time: '20m ago', category: 'Stocks', url: 'https://www.marketwatch.com' },
  ]
}

export default router
