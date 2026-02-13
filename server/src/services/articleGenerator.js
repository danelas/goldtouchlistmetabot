const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============ CITY & SERVICE DATA ============

const CITIES = [
  {
    name: 'Miami',
    state: 'Florida',
    slug: 'miami',
    latitude: 25.7616798,
    longitude: -80.1917902,
    region: 'ChIJEcHIDqKw2YgRZU-t3XHylv8',
    neighborhoods: ['Brickell', 'Wynwood', 'Coral Gables', 'South Beach', 'Downtown Miami', 'Coconut Grove'],
  },
  {
    name: 'Fort Lauderdale',
    state: 'Florida',
    slug: 'fort-lauderdale',
    latitude: 26.1224386,
    longitude: -80.13731740000001,
    region: 'ChIJ9cr6ICcB2YgRvo6_QHW-AnY',
    neighborhoods: ['Las Olas', 'Victoria Park', 'Flagler Village', 'Wilton Manors', 'Oakland Park'],
  },
  {
    name: 'Los Angeles',
    state: 'California',
    slug: 'los-angeles',
    latitude: 34.0549076,
    longitude: -118.242643,
    region: 'ChIJE9on3F3HwoAR9AhGJW_fL-I',
    neighborhoods: ['Beverly Hills', 'Santa Monica', 'West Hollywood', 'Silver Lake', 'Hollywood', 'Downtown LA'],
  },
  {
    name: 'New York',
    state: 'New York',
    slug: 'new-york',
    latitude: 40.7127753,
    longitude: -74.0059728,
    region: 'ChIJOwg_06VPwokRYv534QaPC8g',
    neighborhoods: ['Manhattan', 'Brooklyn', 'Upper East Side', 'Tribeca', 'SoHo', 'Midtown'],
  },
  {
    name: 'Hollywood',
    state: 'Florida',
    slug: 'hollywood-fl',
    latitude: 26.0112014,
    longitude: -80.1494901,
    region: '',
    neighborhoods: ['Hollywood Beach', 'Downtown Hollywood', 'Hallandale'],
  },
  {
    name: 'Broward County',
    state: 'Florida',
    slug: 'broward',
    latitude: 26.1224386,
    longitude: -80.13731740000001,
    region: 'ChIJ9cr6ICcB2YgRvo6_QHW-AnY',
    neighborhoods: ['Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Davie', 'Plantation'],
  },
  {
    name: 'Dallas',
    state: 'Texas',
    slug: 'dallas',
    neighborhoods: ['Uptown', 'Deep Ellum', 'Highland Park', 'Oak Lawn', 'Bishop Arts'],
  },
  {
    name: 'Houston',
    state: 'Texas',
    slug: 'houston',
    neighborhoods: ['Montrose', 'The Heights', 'Midtown', 'River Oaks', 'Galleria'],
  },
  {
    name: 'San Antonio',
    state: 'Texas',
    slug: 'san-antonio',
    neighborhoods: ['River Walk', 'Alamo Heights', 'Stone Oak', 'Southtown', 'Pearl District'],
  },
  {
    name: 'Austin',
    state: 'Texas',
    slug: 'austin',
    neighborhoods: ['South Congress', 'Downtown', 'East Austin', 'Zilker', 'Hyde Park'],
  },
  {
    name: 'Chicago',
    state: 'Illinois',
    slug: 'chicago',
    neighborhoods: ['Lincoln Park', 'Wicker Park', 'Gold Coast', 'River North', 'Lakeview'],
  },
  {
    name: 'Phoenix',
    state: 'Arizona',
    slug: 'phoenix',
    neighborhoods: ['Scottsdale', 'Arcadia', 'Downtown Phoenix', 'Tempe', 'Paradise Valley'],
  },
  {
    name: 'San Diego',
    state: 'California',
    slug: 'san-diego',
    neighborhoods: ['La Jolla', 'Gaslamp Quarter', 'Pacific Beach', 'North Park', 'Hillcrest'],
  },
  {
    name: 'San Francisco',
    state: 'California',
    slug: 'san-francisco',
    neighborhoods: ['Marina', 'SoMa', 'Mission District', 'Pacific Heights', 'Nob Hill'],
  },
  {
    name: 'San Jose',
    state: 'California',
    slug: 'san-jose',
    neighborhoods: ['Willow Glen', 'Santana Row', 'Downtown San Jose', 'Almaden Valley', 'Rose Garden'],
  },
  {
    name: 'Philadelphia',
    state: 'Pennsylvania',
    slug: 'philadelphia',
    neighborhoods: ['Center City', 'Rittenhouse Square', 'Old City', 'Fishtown', 'University City'],
  },
  {
    name: 'Jacksonville',
    state: 'Florida',
    slug: 'jacksonville',
    neighborhoods: ['San Marco', 'Riverside', 'Avondale', 'Jacksonville Beach', 'Ponte Vedra'],
  },
  {
    name: 'Orlando',
    state: 'Florida',
    slug: 'orlando',
    neighborhoods: ['Winter Park', 'Thornton Park', 'Lake Nona', 'College Park', 'Dr. Phillips'],
  },
  {
    name: 'Tampa',
    state: 'Florida',
    slug: 'tampa',
    neighborhoods: ['South Tampa', 'Ybor City', 'Hyde Park', 'Channelside', 'Seminole Heights'],
  },
  {
    name: 'Atlanta',
    state: 'Georgia',
    slug: 'atlanta',
    neighborhoods: ['Buckhead', 'Midtown', 'Virginia-Highland', 'Decatur', 'Inman Park'],
  },
  {
    name: 'Charlotte',
    state: 'North Carolina',
    slug: 'charlotte',
    neighborhoods: ['South End', 'NoDa', 'Uptown', 'Dilworth', 'Plaza Midwood'],
  },
  {
    name: 'Denver',
    state: 'Colorado',
    slug: 'denver',
    neighborhoods: ['LoDo', 'Cherry Creek', 'RiNo', 'Capitol Hill', 'Highlands'],
  },
  {
    name: 'Seattle',
    state: 'Washington',
    slug: 'seattle',
    neighborhoods: ['Capitol Hill', 'Ballard', 'Queen Anne', 'Fremont', 'Belltown'],
  },
  {
    name: 'Portland',
    state: 'Oregon',
    slug: 'portland',
    neighborhoods: ['Pearl District', 'Alberta Arts', 'Hawthorne', 'Nob Hill', 'Division'],
  },
  {
    name: 'Nashville',
    state: 'Tennessee',
    slug: 'nashville',
    neighborhoods: ['The Gulch', 'East Nashville', 'Germantown', '12 South', 'Music Row'],
  },
  {
    name: 'Las Vegas',
    state: 'Nevada',
    slug: 'las-vegas',
    neighborhoods: ['Summerlin', 'Henderson', 'The Strip', 'Downtown', 'Spring Valley'],
  },
  {
    name: 'Boston',
    state: 'Massachusetts',
    slug: 'boston',
    neighborhoods: ['Back Bay', 'Beacon Hill', 'South End', 'Seaport', 'Cambridge'],
  },
  {
    name: 'Washington',
    state: 'Washington',
    slug: 'washington-dc',
    neighborhoods: ['Georgetown', 'Dupont Circle', 'Capitol Hill', 'Adams Morgan', 'Navy Yard'],
  },
  {
    name: 'Baltimore',
    state: 'Maryland',
    slug: 'baltimore',
    neighborhoods: ['Inner Harbor', 'Federal Hill', 'Fells Point', 'Canton', 'Mount Vernon'],
  },
  {
    name: 'Detroit',
    state: 'Michigan',
    slug: 'detroit',
    neighborhoods: ['Midtown', 'Corktown', 'Downtown', 'Grosse Pointe', 'Royal Oak'],
  },
  {
    name: 'Minneapolis',
    state: 'Minnesota',
    slug: 'minneapolis',
    neighborhoods: ['Uptown', 'North Loop', 'Northeast', 'Loring Park', 'St. Paul'],
  },
  {
    name: 'Columbus',
    state: 'Ohio',
    slug: 'columbus',
    neighborhoods: ['Short North', 'German Village', 'Clintonville', 'Grandview', 'Downtown'],
  },
  {
    name: 'Cleveland',
    state: 'Ohio',
    slug: 'cleveland',
    neighborhoods: ['Ohio City', 'Tremont', 'Downtown', 'Lakewood', 'University Circle'],
  },
  {
    name: 'Cincinnati',
    state: 'Ohio',
    slug: 'cincinnati',
    neighborhoods: ['Over-the-Rhine', 'Hyde Park', 'Mount Adams', 'Oakley', 'Downtown'],
  },
  {
    name: 'Indianapolis',
    state: 'Indiana',
    slug: 'indianapolis',
    neighborhoods: ['Broad Ripple', 'Mass Ave', 'Fountain Square', 'Carmel', 'Downtown'],
  },
  {
    name: 'Kansas City',
    state: 'Missouri',
    slug: 'kansas-city',
    neighborhoods: ['Country Club Plaza', 'Westport', 'Crossroads', 'Brookside', 'River Market'],
  },
  {
    name: 'St. Louis',
    state: 'Missouri',
    slug: 'st-louis',
    neighborhoods: ['Central West End', 'Soulard', 'The Loop', 'Clayton', 'Tower Grove'],
  },
  {
    name: 'New Orleans',
    state: 'Louisiana',
    slug: 'new-orleans',
    neighborhoods: ['French Quarter', 'Garden District', 'Marigny', 'Warehouse District', 'Uptown'],
  },
  {
    name: 'Pittsburgh',
    state: 'Pennsylvania',
    slug: 'pittsburgh',
    neighborhoods: ['Shadyside', 'Lawrenceville', 'Strip District', 'South Side', 'Squirrel Hill'],
  },
  {
    name: 'Sacramento',
    state: 'California',
    slug: 'sacramento',
    neighborhoods: ['Midtown', 'East Sacramento', 'Land Park', 'Oak Park', 'Natomas'],
  },
  {
    name: 'Salt Lake City',
    state: 'Utah',
    slug: 'salt-lake-city',
    neighborhoods: ['Sugar House', 'The Avenues', 'Downtown', '9th and 9th', 'Liberty Park'],
  },
  {
    name: 'Raleigh',
    state: 'North Carolina',
    slug: 'raleigh',
    neighborhoods: ['Downtown', 'North Hills', 'Cameron Village', 'Glenwood South', 'Five Points'],
  },
  {
    name: 'Richmond',
    state: 'Virginia',
    slug: 'richmond',
    neighborhoods: ['The Fan', 'Carytown', 'Scott\'s Addition', 'Church Hill', 'Shockoe Bottom'],
  },
  {
    name: 'Milwaukee',
    state: 'Wisconsin',
    slug: 'milwaukee',
    neighborhoods: ['Third Ward', 'East Side', 'Bay View', 'Walker\'s Point', 'Shorewood'],
  },
  {
    name: 'Scottsdale',
    state: 'Arizona',
    slug: 'scottsdale',
    neighborhoods: ['Old Town', 'North Scottsdale', 'McCormick Ranch', 'Gainey Ranch', 'DC Ranch'],
  },
  {
    name: 'Boca Raton',
    state: 'Florida',
    slug: 'boca-raton',
    neighborhoods: ['Mizner Park', 'Royal Palm', 'West Boca', 'Downtown Boca', 'Deerfield Beach'],
  },
  {
    name: 'West Palm Beach',
    state: 'Florida',
    slug: 'west-palm-beach',
    neighborhoods: ['Clematis Street', 'City Place', 'Northwood', 'El Cid', 'South End'],
  },
  {
    name: 'Pompano Beach',
    state: 'Florida',
    slug: 'pompano-beach',
    neighborhoods: ['Lighthouse Point', 'Hillsboro Beach', 'Palm Aire', 'Cypress Creek', 'Downtown Pompano'],
  },
  {
    name: 'Coral Springs',
    state: 'Florida',
    slug: 'coral-springs',
    neighborhoods: ['Parkland', 'Heron Bay', 'Wyndham', 'Riverside', 'Eagle Trace'],
  },
  {
    name: 'Pembroke Pines',
    state: 'Florida',
    slug: 'pembroke-pines',
    neighborhoods: ['Chapel Trail', 'Silver Lakes', 'Pembroke Lakes', 'Century Village', 'Miramar'],
  },
  {
    name: 'Hialeah',
    state: 'Florida',
    slug: 'hialeah',
    neighborhoods: ['Palm Springs', 'Miami Lakes', 'Hialeah Gardens', 'Westland', 'Country Club'],
  },
];

const SERVICES = [
  { name: 'Massage', slug: 'massage', categoryId: 189, searchTerm: 'Mobile Massage' },
  { name: 'Cleaning', slug: 'cleaning', categoryId: 187, searchTerm: 'House Cleaners' },
  { name: 'Skincare', slug: 'skincare', categoryId: 272, searchTerm: 'Estheticians' },
  { name: 'Beauty', slug: 'beauty', categoryId: 213, searchTerm: 'Beauty Professionals' },
  { name: 'Wellness', slug: 'wellness', categoryId: 468, searchTerm: 'Wellness Practitioners' },
];

const ARTICLE_TEMPLATES = [
  {
    type: 'best-in-city',
    titleTemplate: 'Best {service} in {city}',
    description: 'Ranking/discovery page for top providers',
    ctaType: 'client',
  },
  {
    type: 'near-me',
    titleTemplate: '{service} Near Me in {city}',
    description: 'Local search intent page',
    ctaType: 'client',
  },
  {
    type: 'cost-guide',
    titleTemplate: 'How Much Does {service} Cost in {city}',
    description: 'Pricing and comparison guide',
    ctaType: 'client',
  },
  {
    type: 'how-to-choose',
    titleTemplate: 'How to Choose a {service} in {city}',
    description: 'Decision-making guide',
    ctaType: 'client',
  },
  {
    type: 'provider-guide',
    titleTemplate: 'How to Get More {service} Clients in {city}',
    description: 'Provider recruitment article',
    ctaType: 'provider',
  },
];

const PROVIDER_CTA_URL = 'https://goldtouchlist.com/account/login/';

// ============ URL BUILDERS ============

function buildListingUrl(city, service) {
  const location = encodeURIComponent(`${city.name}, ${city.state}`);
  // Cities with full geo data get the precise search URL
  if (city.latitude && city.longitude) {
    return `https://goldtouchlist.com/?post_type=hp_listing&latitude=${city.latitude}&longitude=${city.longitude}&_region=${city.region || ''}&_category=${service.categoryId}&s=&location=${location}&city=${encodeURIComponent(city.name)}`;
  }
  // Cities without geo data get a simpler listing category URL
  return `https://goldtouchlist.com/listing-category/${service.slug}/?location=${location}`;
}

// ============ SYSTEM INSTRUCTIONS ============

const ARTICLE_SYSTEM_PROMPT = `ROLE

You are a professional local SEO content writer for a service marketplace focused on trust, clarity, and conversion.

Your job is to write high-quality, location-specific service articles that rank on Google and convert readers into clients and providers.

VOICE & TONE

Clear, confident, professional
Helpful and practical
Local and grounded (not generic)
Trust-building, not salesy
No hype language
No fluff
No emojis
Write as a knowledgeable local expert helping residents make good decisions.

LANGUAGE RULES

Use simple, direct sentences
Avoid buzzwords and cliches
Avoid exaggerated claims
Avoid AI-like phrasing
Do not repeat ideas
Do not pad length
Prefer clarity over cleverness.

STRUCTURE RULES

Every article must follow this structure:

Introduction (local relevance + user intent)
Main section answering the search intent
Practical guidance (tips, checklist, or comparison)
Local context (city, neighborhood, common needs)
Platform integration (Gold Touch List value)
Call to action (clear next step)

Use H2 and H3 headings. Output the article in valid HTML format suitable for WordPress publishing.

SEO RULES

Naturally include:
Primary keyword in title and first paragraph
City name throughout
Related keywords
Never keyword-stuff
Write for humans first

CONTENT REQUIREMENTS

Each article must include:
At least 3 actionable tips
One checklist or bullet list
One pricing or expectation section (when relevant)
One trust/verification section
One provider-facing paragraph (when appropriate)

LOCALIZATION

Reference real local context:
South Florida climate (for FL cities)
Urban vs suburban service needs
Common apartment/condo situations
Traffic, parking, building access
Mention neighborhoods when appropriate
Avoid generic "any city" language.

PLATFORM POSITIONING

Position Gold Touch List as:
A neutral marketplace
No commissions
Direct connection
Transparent profiles
Provider-controlled pricing
Never claim exclusivity or guaranteed results.
Subtly emphasize the benefit of completing a full service profile and using top placement features when discussing visibility, credibility, and client trust.

CALL TO ACTION RULES

Each article must end with a CTA block containing exactly two buttons and one small tagline.
Do NOT label them with headings like "Client Call to Action" or "Provider Call to Action".
Do NOT put any text on the same line as a button. Each button must be on its own line inside a div.
Do NOT wrap the buttons in a paragraph with other text.
Use the exact CTA block HTML provided in the user prompt.

No aggressive sales language.

FORMATTING

Use short paragraphs (2-4 lines max)
Use bullet points where helpful
No walls of text
No decorative symbols
Output as clean HTML with h2, h3, p, ul, li tags.
Do NOT wrap output in markdown code fences.\nOutput raw HTML only. No \`\`\` fences.

FACTUALITY

Do not invent statistics
Do not fabricate reviews
Do not name fake businesses
If uncertain, use ranges or general guidance

OUTPUT STANDARD

Each article must:
Be 800-1,200 words
Be ready for publishing
Require minimal editing
Be internally consistent
Be plagiarism-free`;

// ============ ARTICLE GENERATION ============

function buildArticlePrompt(template, service, city) {
  const listingUrl = buildListingUrl(city, service);
  const title = template.titleTemplate
    .replace('{service}', service.searchTerm || service.name)
    .replace('{city}', city.name);

  let prompt = `Write an article titled: "${title}"\n\n`;
  prompt += `Target city: ${city.name}, ${city.state}\n`;
  prompt += `Service category: ${service.name}\n`;
  prompt += `Article type: ${template.description}\n\n`;

  if (city.neighborhoods && city.neighborhoods.length > 0) {
    prompt += `Mention these neighborhoods where relevant: ${city.neighborhoods.join(', ')}\n\n`;
  }

  const btnStyle = 'display:block;background:#BE8A4D;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;text-align:center;margin:8px 0;width:fit-content;';

  const ctaBlock = `<div style="margin-top:32px;">
<a href="${listingUrl}" style="${btnStyle}">Browse ${service.name} Providers in ${city.name}</a>
<a href="${PROVIDER_CTA_URL}" style="${btnStyle}">Create Your Free Provider Profile</a>
<p style="font-size:13px;color:#888;margin-top:8px;">No commissions. No middlemen. Providers set their own rates.</p>
</div>`;

  prompt += `End the article with this EXACT CTA block. Copy it verbatim as the last element:\n${ctaBlock}\n\n`;
  prompt += `IMPORTANT: Do NOT add any text around or next to the buttons. Do NOT include headings like "Client Call to Action" or "Provider Call to Action". The CTA block above is the final section of the article - paste it exactly as given.\n`;
  prompt += `Output the full article as raw clean HTML (h2, h3, p, ul, li, a tags). Do NOT wrap in markdown code fences. Do not include the title in the HTML body - it will be set separately. Start directly with the introduction paragraph.`;

  return { title, prompt };
}

async function generateArticle(template, service, city) {
  const { title, prompt } = buildArticlePrompt(template, service, city);

  logger.info('Generating article', { title, city: city.name, service: service.name, type: template.type });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: ARTICLE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4000,
    temperature: 0.7,
  });

  let content = response.choices[0].message.content.trim();

  // Strip markdown code fences if GPT wraps output in ```html ... ```
  content = content.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  logger.info('Article generated', { title, length: content.length });

  return {
    title,
    content,
    city: city.name,
    state: city.state,
    service: service.name,
    categoryId: service.categoryId,
    templateType: template.type,
    listingUrl: buildListingUrl(city, service),
  };
}

// ============ QUEUE MANAGEMENT ============

function generateArticleQueue() {
  const queue = [];

  for (const template of ARTICLE_TEMPLATES) {
    for (const service of SERVICES) {
      for (const city of CITIES) {
        queue.push({
          templateType: template.type,
          serviceSlug: service.slug,
          citySlug: city.slug,
          title: template.titleTemplate
            .replace('{service}', service.searchTerm || service.name)
            .replace('{city}', city.name),
        });
      }
    }
  }

  return queue;
}

function getNextArticle(publishedTitles = []) {
  const queue = generateArticleQueue();
  const remaining = queue.filter((item) => !publishedTitles.includes(item.title));

  if (remaining.length === 0) {
    logger.info('All article combinations have been published');
    return null;
  }

  return remaining[0];
}

function findTemplate(type) {
  return ARTICLE_TEMPLATES.find((t) => t.type === type);
}

function findService(slug) {
  return SERVICES.find((s) => s.slug === slug);
}

function findCity(slug) {
  return CITIES.find((c) => c.slug === slug);
}

module.exports = {
  generateArticle,
  generateArticleQueue,
  getNextArticle,
  findTemplate,
  findService,
  findCity,
  buildListingUrl,
  CITIES,
  SERVICES,
  ARTICLE_TEMPLATES,
};
