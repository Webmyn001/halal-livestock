import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Listing } from '../models/Listing';
import { env } from '../config/env';
import { listingIdFromParam, listingSlugPath } from '../utils/listingId';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function handleListingSocialPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawId = req.params.id;
    const raw = Array.isArray(rawId) ? rawId[0] : rawId;
    const listingId = typeof raw === 'string' ? listingIdFromParam(raw) : '';
    if (!listingId || !Types.ObjectId.isValid(listingId)) {
      return next();
    }

    const listing = await Listing.findById(listingId);
    if (!listing || listing.status === 'removed') {
      res.redirect(`${env.PUBLIC_APP_URL}/marketplace`);
      return;
    }

    const firstImage = listing.images[0]?.url || `${env.PUBLIC_APP_URL}/favicon.png`;
    const priceFormatted = `₦${(listing.priceKobo / 100).toLocaleString()}`;
    const pageTitle = `${listing.title} — ${priceFormatted} | Halal Livestocks`;
    const description = `${priceFormatted} per ${listing.unit} • Located in ${listing.town}, ${listing.state}. ${listing.description.slice(0, 150)}...`;
    const targetUrl = `${env.PUBLIC_APP_URL}${listingSlugPath(listing)}`;

    const userAgent = req.get('user-agent') || '';
    const isBot = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Discordbot|SkypeUriPreview|Google-Structured-Data-Testing-Tool|bingbot|crawler|spider/i.test(userAgent);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Halal Livestocks">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${firstImage}">
  <meta property="og:image:secure_url" content="${firstImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${targetUrl}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${firstImage}">

  <!-- Instant redirect for human browsers -->
  ${!isBot ? `<meta http-equiv="refresh" content="0;url=${targetUrl}">` : ''}
  <script>
    if (!/bot|crawler|spider|facebook|whatsapp|twitter|telegram|slack|discord/i.test(navigator.userAgent)) {
      window.location.replace(${JSON.stringify(targetUrl)});
    }
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f5f5f4; color: #1c1917; padding: 20px;">
  <div style="background: #ffffff; border-radius: 16px; padding: 24px; max-width: 440px; width: 100%; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #e7e5e4; text-align: center;">
    <div style="aspect-ratio: 4/3; width: 100%; max-height: 280px; overflow: hidden; border-radius: 12px; background-color: #f5f5f4;">
      <img src="${firstImage}" alt="${escapeHtml(listing.title)}" style="width: 100%; height: 100%; object-fit: cover;" />
    </div>
    <h1 style="font-size: 19px; font-weight: 700; margin-top: 16px; margin-bottom: 6px; line-height: 1.3;">${escapeHtml(listing.title)}</h1>
    <p style="font-size: 20px; font-weight: 800; color: #15803d; margin: 0 0 4px 0;">${priceFormatted} <span style="font-size: 13px; font-weight: 500; color: #78716c;">per ${listing.unit}</span></p>
    <p style="font-size: 13px; color: #78716c; margin: 0 0 20px 0;">📍 ${escapeHtml(listing.town)}, ${escapeHtml(listing.state)}</p>
    <a href="${targetUrl}" style="display: block; width: 100%; box-sizing: border-box; background-color: #15803d; color: #ffffff; padding: 12px 20px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none;">View Listing on Halal Livestocks</a>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    next(err);
  }
}
