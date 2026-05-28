const fs = require('fs');
const path = require('path');

// ── Image pool (cycled per suburb) ──────────────────────────────────
const images = [
  'hero-banner.jpg','tv-soundbar-mount.jpg','tv-above-fireplace.jpg',
  'living-room-mount.jpg','clean-wall-mount.jpg','apartment-install.jpg',
  'tech-installing.jpg','bracket-closeup.jpg','before-after.png',
  'frame-tv-vj-wall.jpg','smart-tv-netflix.jpg','outdoor-tv-deagon.jpg',
  'tv-mount-vj-panels.webp','tv-mount-living-room-large.jpg',
  'frame-tv-modern-lounge.jpg','tv-soundbar-nrl.jpg','tv-below-artwork.jpg',
  'tilt-bracket-product.jpg'
];

// ── All 55 suburbs (20 existing + 35 new) for footer ───────────────
const allSuburbs = [
  { name:'Banyo', slug:'banyo' },
  { name:'Nudgee', slug:'nudgee' },
  { name:'Virginia', slug:'virginia' },
  { name:'Northgate', slug:'northgate' },
  { name:'Nundah', slug:'nundah' },
  { name:'Toombul', slug:'toombul' },
  { name:'Wavell Heights', slug:'wavell-heights' },
  { name:'Chermside', slug:'chermside' },
  { name:'Chermside West', slug:'chermside-west' },
  { name:'Kedron', slug:'kedron' },
  { name:'Geebung', slug:'geebung' },
  { name:'Zillmere', slug:'zillmere' },
  { name:'Boondall', slug:'boondall' },
  { name:'Taigum', slug:'taigum' },
  { name:'Fitzgibbon', slug:'fitzgibbon' },
  { name:'Carseldine', slug:'carseldine' },
  { name:'Aspley', slug:'aspley' },
  { name:'Hendra', slug:'hendra' },
  { name:'Clayfield', slug:'clayfield' },
  { name:'Wooloowin', slug:'wooloowin' },
  { name:'Ascot', slug:'ascot' },
  { name:'Grange', slug:'grange' },
  { name:'Ashgrove', slug:'ashgrove' },
  { name:'Cashmere', slug:'cashmere' },
  { name:'Warner', slug:'warner' },
  { name:'Bardon', slug:'bardon' },
  { name:'Albany Creek', slug:'albany-creek' },
  { name:'Bracken Ridge', slug:'bracken-ridge' },
  { name:'Hamilton', slug:'hamilton' },
  { name:'Stafford Heights', slug:'stafford-heights' },
  { name:'Arana Hills', slug:'arana-hills' },
  { name:'Ferny Grove', slug:'ferny-grove' },
  { name:'Strathpine', slug:'strathpine' },
  { name:'Samford', slug:'samford' },
  { name:'North Lakes', slug:'north-lakes' },
  { name:'Mango Hill', slug:'mango-hill' },
  { name:'Kallangur', slug:'kallangur' },
  { name:'Dakabin', slug:'dakabin' },
  { name:'Griffin', slug:'griffin' },
  { name:'Rothwell', slug:'rothwell' },
  { name:'Bridgeman Downs', slug:'bridgeman-downs' },
  { name:'McDowall', slug:'mcdowall' },
  { name:'Joyner', slug:'joyner' },
  { name:'Sandgate', slug:'sandgate' },
  { name:'Brighton', slug:'brighton' },
  { name:'Deagon', slug:'deagon' },
  { name:'Kelvin Grove', slug:'kelvin-grove' },
  { name:'The Gap', slug:'the-gap' },
  { name:'Eatons Hill', slug:'eatons-hill' },
  { name:'Brendale', slug:'brendale' },
  { name:'Paddington', slug:'paddington' },
  { name:'Petrie', slug:'petrie' },
  { name:'Redcliffe', slug:'redcliffe' },
  { name:'Scarborough', slug:'scarborough' },
  { name:'Clontarf', slug:'clontarf' },
];

// ── 35 NEW suburbs with unique content & metadata ──────────────────
const newSuburbs = [
  {
    name: 'Ascot',
    slug: 'ascot',
    postcode: '4007',
    nearby: ['hamilton','hendra','clayfield','wooloowin','northgate'],
    intro1: "Ascot is one of Brisbane's most prestigious suburbs, home to Eagle Farm Racecourse and some of the city's finest heritage homes. Brisbane TVs is proud to serve this exclusive community with professional, fixed-price TV wall mounting and technology installation services that match the standard residents expect.",
    intro2: "With its tree-lined streets, grand Queenslanders, and luxury apartment developments along Lancaster Road and Douro Road, Ascot demands nothing less than a premium installation experience. Residents here invest in top-tier Samsung Frame TVs, LG OLED panels, and full home entertainment systems that deserve expert mounting.",
    h2body: "Ascot's housing stock is a striking blend of heritage Queenslander homes, renovated character houses, and high-end modern builds. The classic Queenslanders often feature VJ (vertical joint) timber-lined walls, which require specialist mounting techniques — timber toggle bolts and precise stud location are essential. Newer renovations in Ascot typically introduce plasterboard over timber framing, while the luxury apartments along Racecourse Road feature a mix of concrete and Gyprock walls.",
    experience: "We've completed numerous installations across Ascot's premium homes, from Samsung Frame TV installations on VJ walls in heritage Queenslanders to full cinema setups in modern builds along Lancaster Road. Ascot homeowners particularly appreciate our boot-cover and drop-sheet policy — in homes of this calibre, protecting your floors and furnishings is non-negotiable.",
    tip: "Many Ascot Queenslanders have VJ (vertical joint) timber-lined walls that look stunning but require a different mounting approach than standard Gyprock. We always carry timber-rated fasteners and can reinforce behind the panelling if needed to ensure a rock-solid mount for heavier screens.",
    whyChoose: "Ascot residents expect the best, and that's exactly what Brisbane TVs delivers. Your heritage home or luxury apartment deserves a technician who understands the unique challenges of premium properties — not a handyman with a basic drill. We arrive with commercial-grade stud finders, laser levels, and a van stocked with every bracket and fastener type, so we're prepared for any wall surface Ascot throws at us.",
  },
  {
    name: 'Grange',
    slug: 'grange',
    postcode: '4051',
    nearby: ['kedron','wooloowin','stafford-heights','chermside','clayfield'],
    intro1: "Grange is a leafy, family-friendly suburb just minutes from the CBD, known for its charming mix of renovated Queenslanders and modern townhouses. Brisbane TVs proudly serves Grange residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Situated between Kedron Brook and Lutwyche Road, Grange has undergone significant gentrification in recent years. Young families and professionals are moving in, renovating character homes, and investing in quality home entertainment systems that complement their carefully designed living spaces.",
    h2body: "Grange homes are predominantly renovated Queenslanders and post-war timber houses, with a growing number of modern infill townhouses and duplexes. The older homes frequently feature VJ timber-lined walls downstairs (in enclosed verandahs and extensions) and plasterboard in renovated sections. Newer builds along Wilston Road and Days Road typically have standard Gyprock on steel or timber framing.",
    experience: "We've installed throughout Grange's winding streets, from the elevated homes overlooking Kedron Brook to the newer townhouse developments near Grange train station. The suburb's mix of wall types keeps us on our toes, and we frequently install full-motion brackets in renovated living rooms where the TV needs to be viewable from both the lounge and the kitchen.",
    tip: "Grange's renovated Queenslanders often have a mix of original VJ walls and new plasterboard sections within the same room. We always test the entire wall surface before selecting our anchoring method, as the transition point between old and new materials can shift unexpectedly.",
    whyChoose: "Grange homeowners take pride in their carefully curated interiors, and a TV installation needs to complement — not compromise — the aesthetic. Brisbane TVs specialises in clean, precise installations with hidden cables and perfectly level mounts that look like they were part of the original design.",
  },
  {
    name: 'Ashgrove',
    slug: 'ashgrove',
    postcode: '4060',
    nearby: ['the-gap','bardon','kelvin-grove','grange','paddington'],
    intro1: "Ashgrove is a sought-after inner-city suburb nestled in the foothills west of the CBD, known for its village atmosphere and beautiful character homes. Brisbane TVs is proud to serve Ashgrove residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With its popular cafe strip along Waterworks Road, excellent schools, and strong community feel, Ashgrove attracts families who value quality living. The suburb's elevated position and mature trees create a leafy, private feel, and residents here are upgrading their home entertainment to match their lifestyle.",
    h2body: "Ashgrove's housing stock is dominated by pre-war and post-war Queenslander homes, many extensively renovated with modern ground-floor extensions. These extensions typically feature open-plan living areas with large feature walls — perfect for mounting a big screen. The original upstairs levels often retain their VJ timber walls, while downstairs renovations use standard plasterboard on timber framing. There's also a growing number of contemporary homes and townhouses in the streets off Waterworks Road.",
    experience: "We've completed many installations in Ashgrove's hilly terrain, from grand Queenslanders perched on the ridgeline to compact townhouses near the shops. Ashgrove residents regularly request our cable concealment service because the open-plan downstairs renovations leave no place for dangling HDMI cables to hide.",
    tip: "Ashgrove's steep terrain means many homes have split-level designs with retaining walls visible inside ground-floor rooms. These concrete or block walls are excellent for mounting — incredibly strong — but require our masonry drilling add-on. We always carry the right anchors for these surfaces.",
    whyChoose: "Ashgrove residents appreciate quality craftsmanship, and that's exactly what sets Brisbane TVs apart. We're not general handymen — we're technology installation specialists who understand the unique demands of heritage and character homes. Every installation is backed by our 5-year workmanship warranty.",
  },
  {
    name: 'Cashmere',
    slug: 'cashmere',
    postcode: '4500',
    nearby: ['warner','joyner','albany-creek','eatons-hill','strathpine'],
    intro1: "Cashmere is a peaceful semi-rural suburb in the Pine Rivers region, known for its large blocks, bushland setting, and family-oriented community. Brisbane TVs is proud to serve Cashmere residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Tucked between Warner and Samford, Cashmere offers the best of both worlds — acreage living with easy access to the Strathpine and North Lakes shopping centres. Families here often have dedicated media rooms or large open-plan living areas that are ideal for a premium TV installation.",
    h2body: "Cashmere homes are predominantly large, modern builds on generous blocks, many dating from the 1990s to 2010s. These homes typically feature standard Gyprock on timber framing with good stud spacing, making them ideal for straightforward TV mounting. The larger block sizes mean homes tend to have spacious living rooms and dedicated rumpus rooms — many residents opt for installations in multiple rooms.",
    experience: "We've installed throughout Cashmere's acreage estates and the more compact newer developments. The suburb's quiet streets and friendly residents make it one of our favourite areas to work in. Many Cashmere families book us for dual installations — a main living room setup plus a kids' rumpus room or master bedroom mount.",
    tip: "Cashmere homes on larger blocks often have longer driveways and carport-style garages. Let us know your address details when booking so we can plan our parking and equipment access. We always arrive with everything we need in our van — no second trips required.",
    whyChoose: "Cashmere residents value reliable, professional service without the city premiums. Brisbane TVs offers the same fixed pricing regardless of your distance from the CBD, and our North Brisbane base means Cashmere is well within our core service area.",
  },
  {
    name: 'Warner',
    slug: 'warner',
    postcode: '4500',
    nearby: ['cashmere','joyner','strathpine','brendale','eatons-hill'],
    intro1: "Warner is a thriving family suburb in the Pine Rivers corridor, featuring modern estates, excellent schools, and a strong community atmosphere. Brisbane TVs is proud to serve Warner residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Home to the popular Warner Village shopping centre and surrounded by quality schools including Genesis Christian College, Warner has grown rapidly over the past two decades. The suburb's modern homes and young families mean there's enormous demand for professional TV installations done right the first time.",
    h2body: "Warner's housing stock is predominantly modern, built from the early 2000s onwards. The estates feature rendered brick and Gyprock interiors with steel or timber framing. Wall construction is generally consistent and predictable, which allows for efficient installations. The typical Warner home has an open-plan living area overlooking the kitchen, with a feature wall that's practically designed for a large flat-screen TV.",
    experience: "Warner is one of our highest-demand suburbs, and we frequently complete multiple installations per week here. We've mounted TVs in practically every estate in Warner — from the established sections near Warner Road to the newer developments off Doolan Street. The suburb's consistent build quality means we can often complete installations faster than in older suburbs with unpredictable wall types.",
    tip: "Many Warner homes have recessed niches or pre-wired TV points built into the living room feature wall. If your builder left a niche, we can mount the TV to sit flush or slightly recessed for a clean, built-in look. Send us a photo of your wall when booking and we'll advise on the best approach.",
    whyChoose: "Warner families are busy, and they need an installer who shows up on time, gets the job done quickly, and leaves the house spotless. Brisbane TVs offers fixed pricing with no surprises, SMS booking confirmations, and a typical install time of just 60 minutes.",
  },
  {
    name: 'Bardon',
    slug: 'bardon',
    postcode: '4065',
    nearby: ['ashgrove','paddington','the-gap','kelvin-grove','grange'],
    intro1: "Bardon is an elevated, leafy suburb just 5km from Brisbane's CBD, known for its bushland setting, character homes, and family-friendly atmosphere. Brisbane TVs is proud to serve Bardon residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With its winding streets, creek-side parks, and stunning views from elevated properties, Bardon offers a semi-rural feel remarkably close to the city. The suburb's mix of renovated Queenslanders and architect-designed contemporary homes creates diverse and interesting installation challenges.",
    h2body: "Bardon homes range from classic raised Queenslanders on the higher streets to mid-century brick homes and ultra-modern builds. The Queenslanders feature traditional VJ timber walls upstairs with renovated plasterboard extensions below. The mid-century homes often have double brick construction — excellent for mounting but requiring masonry drilling. Contemporary builds in Bardon tend to feature floor-to-ceiling glazing and carefully selected feature walls that demand a perfectly executed TV installation.",
    experience: "We've worked throughout Bardon's hilly streets, navigating steep driveways and narrow access ways to deliver professional installations. Bardon homeowners often have specific aesthetic requirements — many request Samsung Frame TVs or custom bracket solutions that allow the TV to sit completely flush against the wall.",
    tip: "Bardon's steep terrain means many homes face east or west, leading to significant sun glare at certain times of day. We can advise on anti-glare screen positioning and recommend tilt brackets that allow you to angle the screen away from windows to minimise reflections.",
    whyChoose: "Bardon homeowners invest significantly in their properties, and a cheap-looking TV installation would undermine the entire aesthetic. Brisbane TVs delivers the kind of precise, clean installation that these homes deserve — with hidden cables, perfect levelling, and a finish that looks intentional, not improvised.",
  },
  {
    name: 'Albany Creek',
    slug: 'albany-creek',
    postcode: '4035',
    nearby: ['bridgeman-downs','eatons-hill','aspley','cashmere','brendale'],
    intro1: "Albany Creek is a well-established family suburb in Brisbane's northern corridor, offering a blend of spacious older homes and modern developments. Brisbane TVs is proud to serve Albany Creek residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Centred around the Albany Creek Shopping Village and surrounded by parklands and excellent schools, Albany Creek has been a popular choice for families since the 1980s. The suburb's mature homes are being renovated and upgraded, with TV wall mounting a key part of the modern living room transformation.",
    h2body: "Albany Creek's housing is predominantly brick veneer and rendered masonry homes built from the 1970s through to the 2000s, with newer estates featuring more contemporary Gyprock-and-steel construction. The older brick veneer homes have a mix of plasterboard internal walls and occasional brick feature walls — both of which we're fully equipped to mount on. Many Albany Creek homes have large, dedicated media rooms or rumpus rooms downstairs that are ideal for a cinema-style setup.",
    experience: "Albany Creek is a long-standing part of our core service area, and we've installed in homes throughout the suburb — from the established streets near Old Northern Road to the newer estates backing onto the bushland reserves. The suburb's generous room sizes mean we frequently install 75-inch and larger screens here.",
    tip: "Many Albany Creek homes from the 1980s and 90s have decorative brick feature walls in the living room. These are actually excellent for mounting — brick provides incredibly strong anchoring — but they do require our masonry drilling add-on. The result is a TV that's never coming off that wall.",
    whyChoose: "Albany Creek residents appreciate value and professionalism. Brisbane TVs delivers both — fixed pricing with no hidden fees, a 5-year warranty, and a technician who treats your home with respect. We arrive with boot covers, drop sheets, and a vacuum, because we believe your home should look better when we leave, not worse.",
  },
  {
    name: 'Bracken Ridge',
    slug: 'bracken-ridge',
    postcode: '4017',
    nearby: ['sandgate','brighton','deagon','boondall','fitzgibbon'],
    intro1: "Bracken Ridge is a large, family-friendly suburb in Brisbane's far north, known for its affordable housing, community parks, and easy access to both the bayside and major motorways. Brisbane TVs is proud to serve Bracken Ridge residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With its mix of established homes and newer townhouse developments, Bracken Ridge is home to families at every stage of life. The suburb's proximity to the Sandgate waterfront and major shopping centres at Westfield Chermside makes it a practical and popular choice for North Brisbane living.",
    h2body: "Bracken Ridge features a wide mix of housing types — classic 1970s and 80s brick homes with spacious yards, newer townhouse complexes along Barrett Street and Telegraph Road, and more recent estates with contemporary builds. The older homes typically have Gyprock on timber framing with reliable stud spacing, while the townhouses often have a mix of steel and timber framing with plasterboard walls. Some of the established homes also feature brick feature walls that are perfect for heavy-duty TV mounting.",
    experience: "We complete installations in Bracken Ridge regularly and know the suburb's housing stock well. From compact townhouse living rooms where space-saving wall mounting is essential, to large family rooms in the established homes where a 75-inch screen is the centrepiece, we've handled it all.",
    tip: "Bracken Ridge's proximity to the coast means some homes experience higher humidity levels. We always use stainless steel or zinc-coated hardware for our installations to ensure long-term durability, and we recommend keeping your wall mount bracket accessible for periodic tightening checks.",
    whyChoose: "Bracken Ridge families want reliable service at a fair price, and that's exactly what Brisbane TVs provides. No call-out fees, no hourly rates, no hidden costs — just a fixed price that includes the bracket, installation, and our 5-year warranty.",
  },
  {
    name: 'Hamilton',
    slug: 'hamilton',
    postcode: '4007',
    nearby: ['ascot','hendra','clayfield','wooloowin','northgate'],
    intro1: "Hamilton is one of Brisbane's most exclusive riverfront suburbs, home to Portside Wharf, luxury apartments, and some of the city's most impressive residences. Brisbane TVs is proud to serve Hamilton residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "From the heritage homes perched along Hamilton Hill to the modern luxury apartments at Portside Wharf and the Hamilton Harbour precinct, this suburb represents the pinnacle of Brisbane living. Residents here demand the highest standard of workmanship, and that's exactly what we deliver.",
    h2body: "Hamilton's housing is divided between grand heritage homes on the hill, established brick homes in the lower streets, and premium apartment complexes along the river. The heritage homes feature a variety of wall types including VJ timber, lathe-and-plaster, and modern plasterboard in renovated sections. The luxury apartments at Portside and Hamilton Harbour typically have concrete walls with plasterboard finishes, requiring specialist concrete anchoring for secure TV mounting.",
    experience: "We've completed installations in Hamilton's most prestigious addresses, from penthouse apartments at Portside Wharf to heritage-listed homes on Toorak Road. Hamilton clients typically request premium installations with full cable concealment, and many opt for Samsung Frame TVs that complement their interior design.",
    tip: "Many Hamilton apartments have concrete walls behind the plasterboard, which actually provides the strongest possible mounting surface. However, it requires SDS hammer drilling and chemical anchors for the best result. We always carry the right equipment for concrete work.",
    whyChoose: "Hamilton residents expect perfection, and Brisbane TVs delivers exactly that. Every installation is laser-levelled to the millimetre, cables are concealed behind walls or within carefully routed conduit, and we leave your home immaculate. Our 5-year workmanship warranty gives you complete peace of mind.",
  },
  {
    name: 'Stafford Heights',
    slug: 'stafford-heights',
    postcode: '4053',
    nearby: ['aspley','chermside','kedron','mcdowall','grange'],
    intro1: "Stafford Heights is a well-positioned residential suburb between Chermside and Aspley, offering family-sized homes at accessible prices. Brisbane TVs is proud to serve Stafford Heights residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Known for its quiet residential streets and proximity to Westfield Chermside, Stafford Heights is a practical choice for families who want space without the commute. The suburb's post-war homes are being steadily renovated, and a professionally mounted TV is often one of the first upgrades new owners make.",
    h2body: "Stafford Heights housing is primarily post-war timber and brick homes from the 1950s and 60s, with significant renovation activity transforming many of these into modern family homes. The original homes often feature a mix of fibro, hardboard, and plasterboard walls, while renovated sections typically use standard Gyprock on timber framing. There are also newer townhouse developments providing modern, consistent wall construction.",
    experience: "Stafford Heights is in the heart of our core service area, and we've installed in dozens of homes throughout the suburb. The area's renovation boom means we frequently work in homes that have a mix of old and new wall materials — something that trips up less experienced installers but is routine for us.",
    tip: "Older Stafford Heights homes sometimes have hardboard (Masonite) wall linings that look like plasterboard but behave very differently when drilled. We always test the wall material before selecting our anchoring method, ensuring a secure mount regardless of what's behind the paint.",
    whyChoose: "Stafford Heights residents want professional results without paying inner-city premiums. Brisbane TVs offers the same quality installation at the same fixed price whether you're in Hamilton or Stafford Heights — because great workmanship shouldn't come with a postcode premium.",
  },
  {
    name: 'Arana Hills',
    slug: 'arana-hills',
    postcode: '4054',
    nearby: ['ferny-grove','albany-creek','the-gap','stafford-heights','brendale'],
    intro1: "Arana Hills is a leafy, family-friendly suburb nestled at the base of the D'Aguilar Range, offering a peaceful semi-suburban lifestyle with excellent amenities. Brisbane TVs is proud to serve Arana Hills residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Anchored by the Arana Hills Plaza and surrounded by bushland reserves, Arana Hills combines convenience with a relaxed, natural setting. The suburb's established homes and family-oriented community make it a popular destination for quality home upgrades, including professional TV installations.",
    h2body: "Arana Hills homes are predominantly brick and timber construction from the 1970s and 80s, set on sloping blocks that take advantage of the hilly terrain. Many homes are elevated with enclosed lower levels that serve as rumpus rooms and media spaces — ideal for a dedicated home cinema setup. Wall construction is typically standard Gyprock on timber framing, with some homes featuring brick veneer external walls and occasional internal brick feature walls.",
    experience: "We've installed throughout Arana Hills' hillside streets, from the established homes near Dawson Parade to the elevated properties with spectacular bushland views. The suburb's generous room sizes and dedicated media rooms mean we frequently install larger screens — 65-inch to 85-inch TVs are common here.",
    tip: "Arana Hills' bushy setting means some homes experience reduced mobile and NBN signal strength. If you're considering a Starlink installation alongside your TV mount, we offer both services and can bundle them for a streamlined installation experience.",
    whyChoose: "Arana Hills families value quality work done efficiently. Brisbane TVs arrives fully equipped, completes most installations in about an hour, and leaves your home spotless. Our fixed pricing means no surprises, and our 5-year warranty means complete peace of mind.",
  },
  {
    name: 'Ferny Grove',
    slug: 'ferny-grove',
    postcode: '4055',
    nearby: ['the-gap','arana-hills','ashgrove','samford','brendale'],
    intro1: "Ferny Grove sits at the foothills of the D'Aguilar Range, marking the end of the Ferny Grove train line and the gateway to the Samford Valley. Brisbane TVs is proud to serve this community with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With the recent addition of Ferny Grove Central shopping precinct and the suburb's excellent rail connectivity, Ferny Grove has become increasingly popular with commuting families. The combination of established character homes and new development creates a vibrant, growing community that values quality home services.",
    h2body: "Ferny Grove's housing stock includes a charming mix of post-war timber homes, 1970s and 80s brick builds, and the contemporary townhouses and apartments of the new Ferny Grove Central precinct. The older homes often sit on elevated stumps, with renovated lower levels featuring modern plasterboard walls. The newer developments near the train station have standard Gyprock on steel framing — consistent and straightforward to mount on.",
    experience: "We've completed numerous installations in Ferny Grove, from the established homes along McGinn Road to the brand-new apartments at Ferny Grove Central. The suburb's varied housing stock means we see a real mix of wall types, and our experience across thousands of installations means we're never caught off guard.",
    tip: "If you live in one of Ferny Grove's timber homes near the bushland edge, consider a full-motion bracket that allows you to angle the screen away from window glare. The leafy setting is beautiful, but dappled sunlight moving across your screen can be distracting during afternoon viewing.",
    whyChoose: "Ferny Grove residents appreciate genuine expertise and honest pricing. Brisbane TVs doesn't charge hourly rates or add hidden surcharges — our fixed-price packages include the bracket, professional installation, and a 5-year warranty.",
  },
  {
    name: 'Strathpine',
    slug: 'strathpine',
    postcode: '4500',
    nearby: ['brendale','warner','cashmere','petrie','kallangur'],
    intro1: "Strathpine is the commercial heart of the Pine Rivers region, anchored by Strathpine Centre and serving as a transport hub for the northern corridor. Brisbane TVs is proud to serve Strathpine residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "As the gateway between suburban Brisbane and the Moreton Bay region, Strathpine blends urban convenience with residential affordability. The suburb's diverse housing stock and growing population create strong demand for professional home technology services.",
    h2body: "Strathpine's housing ranges from older weatherboard and fibro homes in the established streets to modern townhouse and unit complexes near the train station and shopping centre. The older homes often feature a mix of original fibro walls and modern plasterboard renovations, while the newer developments have standard Gyprock on steel or timber framing. The suburb's lower price point means many residents are first-home buyers upgrading their spaces for the first time.",
    experience: "Strathpine is centrally located within our service area, and we're frequently in the suburb completing installations. We've worked in everything from compact unit living rooms where maximising floor space is the priority, to established family homes where a full home entertainment system is the goal.",
    tip: "Many Strathpine units and townhouses have body corporate rules about wall modifications. TV wall mounting is generally permitted as a standard fixture, but if you're unsure, check with your body corporate before booking. We're happy to provide a scope-of-work letter if needed for approval.",
    whyChoose: "Strathpine residents want reliable, affordable service from someone who knows what they're doing. Brisbane TVs offers fixed pricing that starts at just $275, includes the bracket, and comes with a 5-year warranty — no hourly rates, no call-out fees, no surprises.",
  },
  {
    name: 'Samford',
    slug: 'samford',
    postcode: '4520',
    nearby: ['ferny-grove','cashmere','the-gap','arana-hills','warner'],
    intro1: "Samford Valley is a picturesque semi-rural suburb at the base of Mount Glorious, offering acreage living with a charming village atmosphere. Brisbane TVs is proud to serve Samford residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Known for its heritage-style village centre, weekend markets, and stunning mountain backdrop, Samford attracts families seeking a rural lifestyle within easy reach of Brisbane. The suburb's larger homes and dedicated living spaces are ideal for premium home entertainment installations.",
    h2body: "Samford homes are typically larger builds on acreage or semi-rural blocks, ranging from contemporary architect-designed residences to established farmhouses and rural-style builds. Construction is predominantly timber framing with plasterboard interiors, though some homes feature rammed earth, stone, or exposed timber walls that require creative mounting solutions. The generous room sizes and high ceilings common in Samford properties create impressive opportunities for large-screen installations.",
    experience: "We've installed in Samford homes ranging from modern acreage builds along Camp Mountain Road to character properties in the village precinct. Samford's larger homes often mean longer cable runs for concealment, and we always arrive with extra-length HDMI cables and conduit to accommodate these bigger spaces.",
    tip: "Samford's rural setting means some homes have non-standard wall materials like rammed earth, timber slab, or stone feature walls. Always let us know your wall type when booking — a quick photo texted to our number helps us arrive with exactly the right equipment for your installation.",
    whyChoose: "Samford residents value quality and authenticity, and Brisbane TVs embodies both. We're not a faceless franchise — we're a local North Brisbane business run by Tom, who personally ensures every installation meets our exacting standards.",
  },
  {
    name: 'North Lakes',
    slug: 'north-lakes',
    postcode: '4509',
    nearby: ['mango-hill','griffin','kallangur','dakabin','rothwell'],
    intro1: "North Lakes is the Moreton Bay region's premier master-planned community, featuring modern homes, Westfield North Lakes, and a vibrant community hub. Brisbane TVs is proud to serve North Lakes residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "As one of Australia's fastest-growing suburbs over the past two decades, North Lakes is home to thousands of modern family homes. The suburb's purpose-built nature means consistent, quality construction — and a population that expects professional-standard home services.",
    h2body: "North Lakes homes are almost exclusively modern builds, constructed from the early 2000s onwards under the master-planned community guidelines. Construction is typically rendered masonry or lightweight cladding with Gyprock internal walls on steel or timber framing. The consistency of North Lakes' housing stock is a significant advantage — predictable wall construction means efficient, reliable installations every time. Most homes feature dedicated media niches or pre-wired TV points in the main living area.",
    experience: "North Lakes is one of our highest-volume suburbs, and we've installed in hundreds of homes across the community. The consistent build quality means we can often complete installations faster here, and we frequently service multiple North Lakes homes in a single day. From the established sections near the lake to the newer stages towards Mango Hill, we know every pocket of this suburb.",
    tip: "Many North Lakes homes have pre-wired power and antenna points at TV height on the feature wall. If your builder installed these, they make cable concealment even cleaner and easier. Let us know if you have pre-wiring when you book — it often simplifies the installation.",
    whyChoose: "North Lakes families have high standards and busy schedules. Brisbane TVs offers a streamlined booking process, fast SMS confirmations, and an average install time of just 60 minutes. We show up on time, get it done right, and leave your home spotless.",
  },
  {
    name: 'Mango Hill',
    slug: 'mango-hill',
    postcode: '4509',
    nearby: ['north-lakes','griffin','kallangur','rothwell','dakabin'],
    intro1: "Mango Hill is a modern residential suburb adjacent to North Lakes, offering quality family homes with excellent transport connections via the Mango Hill and Mango Hill East train stations. Brisbane TVs is proud to serve Mango Hill residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With its relatively new housing stock and young family demographic, Mango Hill is a suburb where professional TV installation is in constant demand. Residents here are setting up their homes for the first time or upgrading their entertainment systems, and they want it done right.",
    h2body: "Mango Hill's housing is predominantly modern, built from the mid-2000s onwards. Like neighbouring North Lakes, construction features rendered brick or lightweight cladding with standard Gyprock interiors on steel or timber frames. The suburb's newer estates often include builder-installed TV recesses and pre-wired points, making cable management straightforward. Townhouse and duplex developments near the train stations present more compact spaces where wall mounting is especially valuable for freeing up floor area.",
    experience: "We install in Mango Hill regularly and have built strong word-of-mouth reputation in the community. The modern construction throughout the suburb allows for clean, efficient installations, and we often receive referrals from satisfied Mango Hill customers to their neighbours.",
    tip: "If you're in a newer Mango Hill townhouse or duplex, check whether your builder installed a TV cavity or recessed niche. These are designed specifically for flush-mounted TVs and can create a stunning built-in entertainment look when combined with our installation service.",
    whyChoose: "Mango Hill residents want quality work at a fair price, delivered by someone who respects their new home. Brisbane TVs brings boot covers, drop sheets, and a vacuum to every job — because your new home deserves to look better after we visit, not worse.",
  },
  {
    name: 'Kallangur',
    slug: 'kallangur',
    postcode: '4503',
    nearby: ['dakabin','petrie','griffin','mango-hill','strathpine'],
    intro1: "Kallangur is an established suburb in the Moreton Bay corridor, offering affordable family homes with good public transport connections. Brisbane TVs is proud to serve Kallangur residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Positioned along the North Coast rail line between Strathpine and Petrie, Kallangur provides convenient living for commuters and families alike. The suburb's mix of older homes and newer developments creates a diverse community with varied TV installation needs.",
    h2body: "Kallangur's housing stock spans several decades — from original fibro and weatherboard homes near the train station to modern rendered brick builds in the newer estates. The older homes often feature a combination of hardboard and plasterboard walls, sometimes on non-standard stud spacing that requires careful detection before mounting. Newer estates in the western sections of the suburb have consistent Gyprock construction that's straightforward to work with.",
    experience: "We've installed throughout Kallangur, from the established pockets near Anzac Avenue to the newer estates towards Mango Hill. Our experience with the suburb's varied housing stock means we arrive prepared for any wall type — something that sets us apart from general handymen who may only be comfortable with standard plasterboard.",
    tip: "Some older Kallangur homes have non-standard stud spacing (sometimes 600mm instead of the typical 450mm). This doesn't prevent mounting, but it does require different bracket positioning. Our multi-function stud finder detects exactly where the studs are, ensuring a secure mount every time.",
    whyChoose: "Kallangur residents deserve the same quality installation as any other suburb. Brisbane TVs charges the same fixed price regardless of postcode — no travel surcharges, no distance fees. Just professional, warrantied workmanship at a fair price.",
  },
  {
    name: 'Dakabin',
    slug: 'dakabin',
    postcode: '4503',
    nearby: ['kallangur','petrie','griffin','north-lakes','mango-hill'],
    intro1: "Dakabin is a developing suburb in the Moreton Bay region, experiencing significant growth with new housing estates and improved infrastructure. Brisbane TVs is proud to serve Dakabin residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With the Dakabin train station providing direct access to Brisbane CBD and ongoing residential development transforming the suburb, Dakabin is attracting young families and first-home buyers looking for value. Setting up a new home with a professionally mounted TV is one of the first things these residents do.",
    h2body: "Dakabin features a mix of established homes from the 1980s and 90s alongside brand-new estates with contemporary builds. The older sections near the train line have typical brick veneer or fibro construction with plasterboard interiors, while the new estates feature modern Gyprock on steel framing with pre-wired entertainment points. The newer homes are particularly well-suited to clean, cable-free TV installations.",
    experience: "We've installed in both the established and new sections of Dakabin, and we understand the distinct differences between the older and newer housing stock. Our installers carry equipment for every wall type, so whether your home was built in 1985 or 2025, we're ready.",
    tip: "If you've just moved into a new Dakabin home, check behind your TV niche for pre-wired power and data points. Many new builders include these as standard, and they make for a much cleaner installation with minimal visible cabling.",
    whyChoose: "Moving into a new home is exciting but overwhelming. Brisbane TVs takes one major task off your list with a fast, professional TV installation that's typically done in about an hour. Fixed pricing means you know the cost upfront — no quotes, no negotiations, no surprises.",
  },
  {
    name: 'Griffin',
    slug: 'griffin',
    postcode: '4503',
    nearby: ['north-lakes','mango-hill','kallangur','dakabin','rothwell'],
    intro1: "Griffin is one of Moreton Bay's newest suburbs, featuring brand-new estates with modern family homes. Brisbane TVs is proud to serve Griffin residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "As a rapidly developing suburb between North Lakes and Kallangur, Griffin is filled with young families setting up their brand-new homes. The suburb's modern construction and planned community design make it an ideal area for professional TV installations.",
    h2body: "Griffin's housing stock is almost entirely new, built from the 2010s onwards. Construction is modern and consistent — rendered lightweight or brick veneer with Gyprock interiors on steel or timber framing. Many homes include dedicated media walls, pre-wired TV points, and entertainment recesses designed for wall-mounted screens. The estate's design guidelines often result in spacious open-plan living areas that are perfect for large-screen installations.",
    experience: "Griffin is one of our fastest-growing service areas, with new families moving in and needing TV installations every week. The consistent, modern construction throughout the suburb allows for efficient installations, and we've built a strong reputation through word-of-mouth referrals from happy Griffin customers.",
    tip: "Griffin's brand-new homes often have their TV pre-wiring points at a standard height. If you want your TV mounted higher or lower than the pre-wired position, we can extend the cabling behind the wall to your preferred location — just let us know when booking.",
    whyChoose: "Griffin families are building their dream homes, and every detail matters. Brisbane TVs ensures your TV installation matches the quality of your new build — laser-levelled, securely anchored, cables hidden, and backed by our 5-year warranty.",
  },
  {
    name: 'Rothwell',
    slug: 'rothwell',
    postcode: '4022',
    nearby: ['redcliffe','scarborough','clontarf','north-lakes','mango-hill'],
    intro1: "Rothwell is a gateway suburb to the Redcliffe Peninsula, offering modern amenities and convenient access to both the peninsula and Brisbane via the Moreton Bay Rail Link. Brisbane TVs is proud to serve Rothwell residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Centred around Rothwell's expanding retail precinct and the nearby Kippa-Ring train station, the suburb serves as a practical hub for Redcliffe Peninsula residents. Its mix of established and new housing provides diverse installation opportunities.",
    h2body: "Rothwell's housing includes established brick homes from the 1970s and 80s, as well as modern townhouse and unit developments that have sprung up near the rail connection. The older homes typically feature standard Gyprock on timber framing with occasional brick feature walls, while newer builds have contemporary plasterboard on steel or timber frames. The suburb's coastal proximity means some homes experience slightly higher humidity, which we factor into our hardware selection.",
    experience: "We've installed throughout Rothwell and the surrounding peninsula suburbs, and the Moreton Bay Rail Link makes the area highly accessible from our North Brisbane base. The suburb's mix of older and newer housing keeps our installations varied and interesting.",
    tip: "Rothwell's coastal location means slightly higher humidity levels. We use zinc-plated and stainless steel hardware for all peninsula installations to ensure long-term corrosion resistance and bracket integrity.",
    whyChoose: "Rothwell residents now have a direct rail link to Brisbane, and they expect city-quality services locally. Brisbane TVs delivers exactly that — professional installations with fixed pricing, quality hardware, and a 5-year warranty.",
  },
  {
    name: 'Bridgeman Downs',
    slug: 'bridgeman-downs',
    postcode: '4035',
    nearby: ['albany-creek','aspley','carseldine','eatons-hill','mcdowall'],
    intro1: "Bridgeman Downs is an elevated, prestige suburb known for its larger blocks, quality homes, and family-oriented community. Brisbane TVs is proud to serve Bridgeman Downs residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Perched on a ridge between Albany Creek and Aspley, Bridgeman Downs offers a premium residential experience with excellent schools, leafy streets, and impressive family homes. Residents here take pride in their properties and expect professional-quality workmanship for every home improvement.",
    h2body: "Bridgeman Downs homes are predominantly large, quality builds from the 1980s onwards, set on generous blocks. Construction typically features rendered brick or brick veneer with plasterboard interiors on timber framing. Many homes have dedicated media rooms, rumpus rooms, or large living areas with high ceilings that are ideal for feature TV installations. Some of the larger properties have multiple living zones that benefit from TV installations in several rooms.",
    experience: "Bridgeman Downs is one of our favourite suburbs to work in, with well-maintained homes and residents who appreciate quality work. We frequently complete multi-room installations here — master bedroom, main living room, and rumpus room are a popular combination.",
    tip: "Bridgeman Downs' larger homes often have high ceilings in the main living area. For screens mounted on high walls, a tilt bracket is essential to angle the screen downward for comfortable viewing from the sofa. We can recommend the ideal mounting height based on your ceiling height and viewing distance.",
    whyChoose: "Bridgeman Downs homeowners have invested significantly in their properties and expect a TV installation to match that standard. Brisbane TVs delivers precision workmanship with commercial-grade equipment, not a handyman with a consumer-grade drill.",
  },
  {
    name: 'McDowall',
    slug: 'mcdowall',
    postcode: '4053',
    nearby: ['stafford-heights','aspley','bridgeman-downs','chermside','kedron'],
    intro1: "McDowall is a quiet, elevated suburb tucked between Aspley and Stafford Heights, offering spacious family homes in a peaceful bushland setting. Brisbane TVs is proud to serve McDowall residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Known for its excellent local schools, bushland walking trails, and strong community atmosphere, McDowall is a suburb where families put down roots. The larger homes and generous living spaces make it ideal for premium home entertainment installations.",
    h2body: "McDowall's housing stock is predominantly well-maintained family homes from the 1970s through to the 2000s. Construction is typically brick veneer or rendered masonry with plasterboard interiors on timber framing. The suburb's elevated terrain means many homes have split-level designs with lower-level rumpus rooms that residents convert into dedicated entertainment spaces. Some homes also feature retaining walls and exposed brick that create interesting feature wall opportunities for TV mounting.",
    experience: "We've installed throughout McDowall's quiet residential streets, from the homes backing onto Chermside Hills Reserve to the properties near McDowall State School. The suburb's spacious homes mean we frequently install larger screens and multi-component entertainment systems including soundbar mounting.",
    tip: "McDowall's bushland setting creates beautiful views, but it also means some rooms have significant tree-filtered light throughout the day. We can advise on optimal screen positioning to minimise glare while keeping your view unobstructed.",
    whyChoose: "McDowall residents value quality, reliability, and a personal touch. Brisbane TVs is run by Tom, a local North Brisbane specialist who takes personal responsibility for every installation. You're not getting a random subcontractor — you're getting a dedicated professional who cares about the result.",
  },
  {
    name: 'Joyner',
    slug: 'joyner',
    postcode: '4500',
    nearby: ['warner','cashmere','strathpine','brendale','albany-creek'],
    intro1: "Joyner is a small, family-oriented suburb in the Pine Rivers corridor, known for its quality homes, community feel, and bushland surrounds. Brisbane TVs is proud to serve Joyner residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Nestled between Warner and Cashmere, Joyner offers a quiet, family-friendly environment with good-sized homes and access to Pine Rivers State High School. The suburb's modern homes and family demographic make it a consistent market for professional TV installations.",
    h2body: "Joyner homes are predominantly modern builds from the 1990s and 2000s, featuring rendered brick or lightweight cladding with standard Gyprock interiors. The housing is well-maintained and consistent, with most homes featuring open-plan living areas, dedicated media rooms, or rumpus rooms. Wall construction is typically plasterboard on timber framing with standard 450mm stud spacing — ideal for secure TV mounting without additional reinforcement.",
    experience: "We've installed in Joyner's family estates and know the suburb's housing well. The consistent, quality construction throughout the suburb allows for efficient, clean installations. Joyner residents frequently book us after being referred by their Warner or Cashmere neighbours.",
    tip: "Joyner homes often have rumpus rooms or second living areas at the rear of the house that are perfect for a dedicated kids' entertainment zone. We offer multi-room installation packages that make setting up two or more TVs both convenient and cost-effective.",
    whyChoose: "Joyner residents are part of our core Pine Rivers service area, and we're always nearby. Brisbane TVs offers same-day or next-day availability in the Pine Rivers corridor, with fixed pricing and a 5-year warranty on every installation.",
  },
  {
    name: 'Sandgate',
    slug: 'sandgate',
    postcode: '4017',
    nearby: ['brighton','deagon','bracken-ridge','boondall','fitzgibbon'],
    intro1: "Sandgate is a charming bayside suburb with a rich heritage, waterfront esplanade, and village atmosphere. Brisbane TVs is proud to serve Sandgate residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With its historic main street, seaside parklands, and strong community identity, Sandgate is one of Brisbane's most distinctive suburbs. The mix of beautifully restored Queenslanders and modern coastal-style homes creates a unique character that extends to residents' thoughtful approach to home entertainment.",
    h2body: "Sandgate's housing stock is wonderfully diverse — grand heritage Queenslanders along the esplanade, renovated post-war homes in the back streets, and modern townhouse developments near the train station. The heritage homes often feature VJ timber walls, ornate timber fretwork, and high ceilings, while renovated homes typically have plasterboard extensions and modern living areas. The newer coastal-style builds feature standard Gyprock on timber or steel framing.",
    experience: "We've worked throughout Sandgate's character-filled streets, from the grand homes along Brighton Road to the more compact townhouses near the foreshore. Sandgate's heritage homes present some of our most interesting installation challenges, and we take great pride in delivering clean, unobtrusive mounts that respect the architectural character.",
    tip: "Sandgate's coastal environment means salt air exposure, particularly for homes near the esplanade. We use marine-grade stainless hardware for foreshore installations and recommend indoor-only mounting locations rather than outdoor or alfresco areas to maximise bracket and TV longevity.",
    whyChoose: "Sandgate residents care deeply about their suburb's character, and so do we. Brisbane TVs approaches every heritage home installation with the sensitivity and expertise these beautiful properties deserve. No unnecessary holes, no damage to original features, and a result that looks like it belongs.",
  },
  {
    name: 'Brighton',
    slug: 'brighton',
    postcode: '4017',
    nearby: ['sandgate','deagon','bracken-ridge','boondall','redcliffe'],
    intro1: "Brighton is a peaceful bayside suburb nestled between Sandgate and Deagon, offering waterfront living with a relaxed, community-focused atmosphere. Brisbane TVs is proud to serve Brighton residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With its proximity to the Bramble Bay foreshore, Brighton attracts families and retirees who appreciate the coastal lifestyle. The suburb's mix of established homes and newer developments creates steady demand for professional TV installations.",
    h2body: "Brighton's housing ranges from post-war timber and fibro homes in the established streets to modern rendered brick builds and contemporary coastal-style residences. The older homes typically have plasterboard or hardboard walls on timber framing, while newer properties feature standard Gyprock construction. Brighton's coastal location means some homes have aluminium window walls or large glass sliding doors that impact TV placement — we can help identify the best wall and position for your screen.",
    experience: "We service Brighton alongside neighbouring Sandgate and Deagon, giving us efficient coverage of the bayside suburbs. Our familiarity with the area's coastal housing stock means we arrive prepared with the right hardware for the salt-air environment.",
    tip: "Brighton's waterfront homes often have stunning views that compete with the TV for attention. A full-motion bracket lets you swivel the screen to face different seating areas, and you can push it flat against the wall when you'd rather enjoy the bay view through your windows.",
    whyChoose: "Brighton residents love their relaxed lifestyle, and Brisbane TVs fits right in. We provide a no-fuss service — book via text, get a fixed price, and we arrive on time with everything needed. No sales pitches, no upselling, just professional installation and a friendly chat.",
  },
  {
    name: 'Deagon',
    slug: 'deagon',
    postcode: '4017',
    nearby: ['sandgate','brighton','bracken-ridge','boondall','nudgee'],
    intro1: "Deagon is a small, established suburb between Sandgate and Boondall, offering affordable bayside living with a strong community identity. Brisbane TVs is proud to serve Deagon residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Close to the Boondall Wetlands and the Sandgate foreshore, Deagon provides a quieter alternative to its more prominent neighbours. The suburb's modest, well-maintained homes are being upgraded by both long-term residents and new buyers, with TV wall mounting a popular improvement.",
    h2body: "Deagon's housing is predominantly post-war timber and fibro homes, many of which have been renovated with modern extensions. The original construction often features hardboard or fibro-cement wall linings, while renovated sections use standard plasterboard on timber framing. The suburb's compact lot sizes mean living rooms tend to be more modestly sized, making wall-mounted TVs especially valuable for maximising floor space.",
    experience: "We've installed in Deagon's compact homes and understand the suburb's housing well. Our experience with older fibro and hardboard wall materials means we arrive with the right anchoring solutions — something many installers overlook in favour of standard plasterboard techniques.",
    tip: "Deagon's older homes sometimes have asbestos-containing fibro sheets as wall linings. We can identify these materials and will not drill into suspected asbestos. If asbestos is identified, we'll recommend adjacent plasterboard walls or alternative mounting solutions to keep you safe.",
    whyChoose: "Deagon residents want honest, reliable service at a fair price. Brisbane TVs delivers exactly that — we'll always tell you the safest and best mounting option for your specific wall type, even if it means recommending an alternative approach.",
  },
  {
    name: 'Kelvin Grove',
    slug: 'kelvin-grove',
    postcode: '4059',
    nearby: ['ashgrove','paddington','grange','kedron','wooloowin'],
    intro1: "Kelvin Grove is a vibrant inner-city suburb that blends student life, creative industries, and established residential pockets just 2km from Brisbane's CBD. Brisbane TVs is proud to serve Kelvin Grove residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Home to QUT's Kelvin Grove campus, the Kelvin Grove Urban Village, and a thriving arts precinct, this suburb attracts a diverse mix of students, young professionals, and long-term residents. The area's mix of apartments, townhouses, and character homes creates varied and interesting installation opportunities.",
    h2body: "Kelvin Grove's housing stock is exceptionally diverse — from the modern apartments and townhouses of the Urban Village to heritage Queenslanders on the hillside and post-war homes in the established streets. The Urban Village apartments typically have concrete walls with plasterboard finishes, requiring concrete anchoring techniques. The older homes feature VJ timber walls, plasterboard, and occasional brick construction. This diversity means every installation in Kelvin Grove is a little different.",
    experience: "We've installed in Kelvin Grove's varied housing types, from compact studio apartments in the Urban Village to spacious Queenslanders overlooking Victoria Park. The suburb's proximity to our service area makes it easy to provide fast turnaround and same-day availability.",
    tip: "Kelvin Grove's apartment buildings often have specific rules about wall modifications. We provide a neat, professional installation that typically falls within standard fixture provisions, but it's worth checking your building's by-laws before booking if you're renting or in a body corporate.",
    whyChoose: "Kelvin Grove residents range from students on a budget to professionals who want premium quality. Brisbane TVs' tiered pricing structure means there's a package for every need, from a simple bedroom mount at $275 to a full cinema installation at $550.",
  },
  {
    name: 'The Gap',
    slug: 'the-gap',
    postcode: '4061',
    nearby: ['ashgrove','bardon','ferny-grove','arana-hills','kelvin-grove'],
    intro1: "The Gap is a large, leafy suburb nestled in a valley at the base of Mount Coot-tha, offering a semi-rural atmosphere just 8km from Brisbane's CBD. Brisbane TVs is proud to serve The Gap residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Surrounded by bushland reserves and state forest, The Gap provides a peaceful, nature-filled lifestyle that appeals to families, professionals, and retirees. The suburb's established homes and generous block sizes create ideal conditions for premium home entertainment setups.",
    h2body: "The Gap's housing is predominantly well-maintained family homes from the 1960s through to the 2000s. Construction ranges from post-war timber homes on elevated stumps to large contemporary builds on the hillside. The typical The Gap home has brick veneer or timber construction with plasterboard interiors, spacious living areas, and often a dedicated rumpus room or second living space. The hilly terrain means many homes have split-level designs with interesting wall configurations.",
    experience: "We've navigated The Gap's winding streets and steep driveways to deliver installations throughout the suburb. From the family homes near The Gap State High School to the elevated properties along Waterworks Road, we know this suburb's housing stock inside out.",
    tip: "The Gap's bushy setting and valley location can affect NBN and mobile signal quality. If you're experiencing buffering issues on your smart TV, consider our Starlink installation service alongside your TV mount for a reliable, high-speed internet connection independent of the NBN.",
    whyChoose: "The Gap residents love their peaceful, natural surroundings and don't want the hassle of dealing with unreliable tradespeople. Brisbane TVs offers a simple, professional service — text us, get a fixed price, and we'll be there when we say we will.",
  },
  {
    name: 'Eatons Hill',
    slug: 'eatons-hill',
    postcode: '4037',
    nearby: ['albany-creek','brendale','bridgeman-downs','warner','cashmere'],
    intro1: "Eatons Hill is a modern, family-focused suburb known for its popular hotel, quality homes, and convenient northern location. Brisbane TVs is proud to serve Eatons Hill residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Positioned between Albany Creek and Brendale, Eatons Hill has grown rapidly with modern family estates that attract young families seeking space, quality schools, and community amenities. The Eatons Hill Hotel serves as the social hub of the suburb, and the residential areas surrounding it are filled with well-presented modern homes.",
    h2body: "Eatons Hill's housing is predominantly modern, built from the 1990s onwards. Construction features rendered brick or lightweight cladding with standard Gyprock interiors on timber framing. The suburb's homes tend to be family-sized with open-plan living areas, dedicated media rooms, and multiple living zones. Wall construction is consistent and predictable — standard plasterboard on 450mm-spaced timber studs — making Eatons Hill one of the most straightforward suburbs in our service area for clean installations.",
    experience: "We install in Eatons Hill frequently and have established a strong reputation in the suburb through referrals. The modern, consistent housing stock allows us to work efficiently, and many Eatons Hill families book multi-room installations to set up their main living room, master bedroom, and kids' rumpus room.",
    tip: "Eatons Hill homes often have built-in entertainment units or shelving on either side of the TV wall. We can mount your screen to sit perfectly centred above or within these units, creating a built-in entertainment centre look without the custom carpentry costs.",
    whyChoose: "Eatons Hill families want a fast, professional job done by someone who respects their home. Brisbane TVs delivers exactly that — we're typically in and out within 60 minutes, leaving nothing behind but a perfectly mounted TV and a spotless room.",
  },
  {
    name: 'Brendale',
    slug: 'brendale',
    postcode: '4500',
    nearby: ['strathpine','warner','eatons-hill','albany-creek','joyner'],
    intro1: "Brendale is known as the commercial and industrial hub of the Pine Rivers region, but it also features established residential pockets and newer housing estates. Brisbane TVs is proud to serve Brendale residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "While Brendale is best known for its business parks and retail outlets, the suburb's residential areas along South Pine Road and the surrounding streets offer affordable family homes. The proximity to Warner, Strathpine, and Eatons Hill makes Brendale a practical choice for families and workers in the Pine Rivers corridor.",
    h2body: "Brendale's residential housing is a mix of established homes from the 1970s and 80s and newer townhouse and unit developments. The older homes feature standard brick veneer or timber construction with plasterboard interiors, while the newer developments have modern Gyprock on steel framing. Some Brendale homes are located near the commercial zone and may have higher ambient noise levels, making a quality home entertainment system with proper soundbar mounting especially valuable.",
    experience: "We service Brendale as part of our broader Pine Rivers coverage and have installed in the suburb's residential pockets as well as some commercial premises. Our experience with both residential and light commercial installations means we can handle any Brendale project.",
    tip: "If you live near Brendale's commercial areas, you may experience more ambient noise from traffic and businesses. A quality soundbar mounted below your TV can make a significant difference — we offer soundbar installation as an add-on to any TV mounting package.",
    whyChoose: "Brendale residents benefit from being in our core Pine Rivers service area, with excellent availability and no travel surcharges. Brisbane TVs offers the same professional, fixed-price service whether you're in a residential street or a home near the commercial precinct.",
  },
  {
    name: 'Paddington',
    slug: 'paddington',
    postcode: '4064',
    nearby: ['bardon','kelvin-grove','ashgrove','grange','hamilton'],
    intro1: "Paddington is one of Brisbane's most iconic inner-city suburbs, famous for its heritage Queenslander homes, boutique shopping, and vibrant cafe culture along Given Terrace and Latrobe Terrace. Brisbane TVs is proud to serve Paddington residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With its steep, winding streets and stunning city skyline views, Paddington represents the best of Brisbane's character living. Residents here are passionate about preserving and enhancing their beautiful homes, and a professional TV installation must complement — never compromise — the architectural heritage.",
    h2body: "Paddington's housing stock is dominated by heritage Queenslander homes, many over 100 years old, featuring traditional VJ timber-lined walls, high ceilings with ornate cornices, and wide verandahs. Renovated homes typically add modern plasterboard extensions at the rear or underneath, creating a mix of heritage and contemporary wall surfaces within a single property. The suburb's steep terrain also means some homes have exposed brick or stone retaining walls at lower levels that can serve as dramatic feature walls for TV mounting.",
    experience: "We've completed numerous installations in Paddington's heritage homes, and we understand the particular care required when working with VJ timber walls, ornate plasterwork, and century-old construction. Paddington homeowners consistently choose us because we take the time to find the perfect mounting solution that respects their home's character.",
    tip: "Paddington's VJ timber walls require a specific mounting approach — we use timber-rated coach screws into the studs behind the VJ boards, with reinforcement plates if needed for heavier screens. The result is a rock-solid mount that won't compromise the heritage timber panelling.",
    whyChoose: "Paddington homes are irreplaceable heritage assets, and they deserve an installer who treats them with the respect they've earned over a century. Brisbane TVs combines modern technology expertise with an appreciation for traditional craftsmanship — the result is a TV installation that looks like it was always part of the plan.",
  },
  {
    name: 'Petrie',
    slug: 'petrie',
    postcode: '4502',
    nearby: ['kallangur','strathpine','dakabin','joyner','brendale'],
    intro1: "Petrie is an established suburb in the Moreton Bay region that's undergoing significant renewal, including the new USC Moreton Bay campus and surrounding development. Brisbane TVs is proud to serve Petrie residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With the University of the Sunshine Coast campus bringing new energy to the area and ongoing residential development, Petrie is a suburb in transition. Both long-term residents and newcomers are investing in home upgrades, and professional TV mounting is a popular starting point.",
    h2body: "Petrie's housing stock reflects the suburb's evolving character — established fibro and timber homes from the 1960s and 70s sit alongside modern townhouse developments and newer estates. The older homes often feature a combination of hardboard, fibro, and plasterboard walls, while the newer builds have standard Gyprock on steel or timber framing. The development around the university campus is bringing contemporary apartment-style living to the suburb for the first time.",
    experience: "We've installed in Petrie's established streets and newer developments, and we understand the distinct wall types found across the suburb. Our experience with older construction materials ensures a secure mount regardless of your home's age.",
    tip: "Older Petrie homes may have fibro-cement wall linings in some rooms. If your walls have a smooth, hard surface that sounds hollow when knocked, let us know when booking — it could be fibro, which requires specific assessment before drilling to ensure safety.",
    whyChoose: "Petrie residents are part of a changing, growing community, and Brisbane TVs is proud to be part of that growth. We offer reliable, professional service at fixed prices, with the same quality of workmanship whether your home is brand new or well-established.",
  },
  {
    name: 'Redcliffe',
    slug: 'redcliffe',
    postcode: '4020',
    nearby: ['scarborough','clontarf','rothwell','north-lakes','mango-hill'],
    intro1: "Redcliffe is the vibrant heart of the Redcliffe Peninsula, famous for its foreshore esplanade, Sunday markets, and proud community identity. Brisbane TVs is proud to serve Redcliffe residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With the Moreton Bay Rail Link connecting the peninsula to Brisbane CBD, Redcliffe has experienced a renaissance. The suburb's mix of waterfront apartments, renovated beach houses, and established family homes creates a diverse community with varied home entertainment needs.",
    h2body: "Redcliffe's housing stock is wonderfully varied — from the iconic fibro and timber beach cottages that defined the suburb's holiday origins, to modern waterfront apartments and contemporary family homes. The older cottages often feature hardboard or fibro-cement walls with timber framing, while the apartment complexes along Redcliffe Parade have concrete construction with plasterboard finishes. The suburb's coastal location demands careful hardware selection to resist salt air corrosion.",
    experience: "We've installed throughout Redcliffe, from the foreshore apartments with ocean views to the established family homes in the back streets. The peninsula's unique housing stock keeps our work varied and interesting, and we've developed specific techniques for the older beach cottage construction that's so common here.",
    tip: "Redcliffe's salt air environment accelerates hardware corrosion. We exclusively use stainless steel and marine-grade hardware for all Redcliffe Peninsula installations, and we recommend against outdoor TV mounting locations unless you have a fully enclosed alfresco area.",
    whyChoose: "Redcliffe residents have watched their suburb transform, and they want services that match the peninsula's new energy. Brisbane TVs brings professional, city-quality installations to the peninsula with no distance surcharges — just the same fixed pricing and 5-year warranty we offer everywhere.",
  },
  {
    name: 'Scarborough',
    slug: 'scarborough',
    postcode: '4020',
    nearby: ['redcliffe','clontarf','rothwell','north-lakes','brighton'],
    intro1: "Scarborough is a sought-after waterfront suburb on the northern tip of the Redcliffe Peninsula, known for its harbour, boat ramp, and stunning Moreton Bay views. Brisbane TVs is proud to serve Scarborough residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "With its marina, waterfront parks, and increasingly upmarket residential developments, Scarborough is attracting residents who want a coastal lifestyle with modern amenities. The suburb's premium waterfront properties and renovated beach houses create demand for quality home entertainment installations.",
    h2body: "Scarborough's housing ranges from original fibro beach houses — some still in original condition — to luxury waterfront homes and modern townhouse developments. The older properties feature a mix of fibro-cement and hardboard walls on timber framing, while renovated and new homes use standard Gyprock construction. The waterfront properties along Kate Street and the harbour precinct often feature large living areas with floor-to-ceiling windows and impressive feature walls that are perfect for statement TV installations.",
    experience: "We've completed installations in Scarborough's waterfront homes and back-street cottages alike. The suburb's salt air environment has given us extensive experience with marine-grade hardware selection and corrosion-resistant installation techniques.",
    tip: "Scarborough's waterfront homes often have stunning views that you don't want a TV to obstruct. A full-motion bracket allows you to mount the TV on a side wall and swing it into viewing position only when needed, keeping your bay vista unobstructed the rest of the time.",
    whyChoose: "Scarborough residents are investing in their waterfront properties, and they deserve installation quality that matches. Brisbane TVs uses marine-grade hardware, provides a 5-year warranty, and treats every home — whether a modest cottage or a waterfront showpiece — with the same professional care.",
  },
  {
    name: 'Clontarf',
    slug: 'clontarf',
    postcode: '4019',
    nearby: ['redcliffe','scarborough','rothwell','sandgate','brighton'],
    intro1: "Clontarf is a family-friendly suburb on the Redcliffe Peninsula's southern shore, offering waterfront parks, excellent schools, and a relaxed coastal lifestyle. Brisbane TVs is proud to serve Clontarf residents with professional, fixed-price TV wall mounting and technology installation services.",
    intro2: "Positioned along Hornibrook Esplanade with views across Bramble Bay, Clontarf combines the peninsula's coastal charm with a strong family community. The suburb's mix of established homes and modern renovations creates diverse opportunities for professional TV installations.",
    h2body: "Clontarf's housing stock includes post-war timber and fibro cottages, brick veneer homes from the 1970s and 80s, and modern renovations that have transformed many of the original beach houses into contemporary family homes. The older construction features a mix of hardboard, fibro-cement, and plasterboard walls, while renovated and newer homes have standard Gyprock on timber or steel framing. The suburb's waterfront properties often feature open-plan living areas designed to capture the bay views.",
    experience: "We've installed throughout Clontarf, from the waterfront homes along Hornibrook Esplanade to the established streets near Clontarf Beach State High School. Our experience with the peninsula's varied housing stock means we arrive prepared for any wall type and any coastal-environment challenge.",
    tip: "Clontarf's bay-facing living rooms often have large windows that create afternoon glare on TV screens. We can advise on optimal TV positioning and recommend anti-glare solutions, including tilt brackets and strategic wall placement, to ensure comfortable viewing at all times of day.",
    whyChoose: "Clontarf families want a reliable, professional service that understands their peninsula lifestyle. Brisbane TVs serves the Redcliffe Peninsula as part of our core North Brisbane coverage — no distance surcharges, no travel fees, just honest fixed pricing and professional workmanship.",
  },
];

// ── Helper functions ────────────────────────────────────────────────
function img(index) {
  return images[index % images.length];
}

function footerSuburbsHtml() {
  return allSuburbs.map(s => `                    <a href="${s.slug}.html">${s.name}</a>`).join('\n');
}

function nearbyHtml(suburb) {
  return suburb.nearby.map(slug => {
    const s = allSuburbs.find(a => a.slug === slug);
    if (!s) return '';
    return `            <a href="${s.slug}.html" class="btn btn-outline" style="font-size:0.9rem;padding:0.6rem 1.25rem;">${s.name}</a>`;
  }).filter(Boolean).join('\n');
}

// ── Page generator ──────────────────────────────────────────────────
function generatePage(suburb, index) {
  const i0 = (index * 3) % images.length;
  const i1 = (index * 3 + 1) % images.length;
  const i2 = (index * 3 + 2) % images.length;
  const i3 = (index * 3 + 3) % images.length;
  const i4 = (index * 3 + 4) % images.length;
  const i5 = (index * 3 + 5) % images.length;
  const i6 = (index * 3 + 6) % images.length;
  const nameUpper = suburb.name.toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TV Wall Mounting ${suburb.name} | From $275 | Brisbane TVs</title>
    <meta name="description" content="Professional tv wall mounting in ${suburb.name} ${suburb.postcode}. Fixed-price packages from $275. Bracket included. Cable concealment available. tv mounting ${suburb.name} specialists. 5-year warranty. Book today.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Brisbane TVs",
      "description": "Professional TV wall mounting and installation service in ${suburb.name}",
      "url": "https://brisbanetvs.com/${suburb.slug}.html",
      "telephone": "1300312271",
      "email": "hello@brisbanetvs.com",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "North Brisbane",
        "addressRegion": "QLD",
        "postalCode": "4000",
        "addressCountry": "AU"
      },
      "areaServed": {
        "@type": "Place",
        "name": "${suburb.name}",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "${suburb.name}",
          "addressRegion": "QLD",
          "postalCode": "${suburb.postcode}",
          "addressCountry": "AU"
        }
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "TV Mounting Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "TV Wall Mounting - Bedroom Package",
              "description": "Flat or tilt bracket supplied and installed for screens 32 to 55 inches"
            },
            "price": "275.00",
            "priceCurrency": "AUD"
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "TV Wall Mounting - Living Room Package",
              "description": "Heavy-duty bracket for screens 56 to 75 inches with two-technician lift"
            },
            "price": "385.00",
            "priceCurrency": "AUD"
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "TV Wall Mounting - Cinema Package",
              "description": "Extra-heavy bracket with reinforced anchoring for screens 76 to 85 inches"
            },
            "price": "550.00",
            "priceCurrency": "AUD"
          }
        ]
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5",
        "reviewCount": "3"
      },
      "review": [
        {
          "@type": "Review",
          "reviewRating": { "@type": "Rating", "ratingValue": "5" },
          "author": { "@type": "Person", "name": "Matt Gilroy" },
          "reviewBody": "Amazing service from Tom — came out same day to mount our 65\\" TV and was done within an hour. Professional job, no fuss, at a great price."
        },
        {
          "@type": "Review",
          "reviewRating": { "@type": "Rating", "ratingValue": "5" },
          "author": { "@type": "Person", "name": "Amanda Sciortino" },
          "reviewBody": "Tom from Rentek did an amazing job mounting our new tv on the wall and concealing the cables. So happy and would certainly recommend him for his prompt, professional service at a very reasonable price!"
        },
        {
          "@type": "Review",
          "reviewRating": { "@type": "Rating", "ratingValue": "5" },
          "author": { "@type": "Person", "name": "Scott Adams" },
          "reviewBody": "A zero fuss, professional service. Quoted, arrived, and installed within a couple of hours. Found him to be a friendly and outgoing guy and recommend him to anyone. Top shelf."
        }
      ]
    }
    </script>
</head>
<body>

<!-- Top Bar -->
<div class="topbar">
    5-YEAR WARRANTY &nbsp;|&nbsp; FULLY INSURED &nbsp;|&nbsp; NORTH BRISBANE SPECIALISTS &nbsp;&mdash;&nbsp; <a href="tel:1300312271">1300 312 271</a>
</div>

<!-- Header -->
<header>
    <div class="container">
        <a href="index.html" class="logo">BRISBANE <span>TVs</span></a>
        <nav>
            <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="services.html">Services &amp; FAQ</a></li>
                <li><a href="about.html">About Us</a></li>
                <li><a href="book.html">Book Online</a></li>
            </ul>
        </nav>
        <a href="tel:1300312271" class="nav-phone">1300 312 271</a>
        <button class="mobile-toggle" onclick="document.querySelector('nav ul').style.display=document.querySelector('nav ul').style.display==='flex'?'none':'flex'" aria-label="Menu">&#9776;</button>
    </div>
</header>

<!-- Page Hero -->
<section class="page-hero">
    <div class="container">
        <p class="section-label" style="color:#93c5fd;">TV WALL MOUNTING &amp; STARLINK</p>
        <h1>TV Wall Mounting ${suburb.name} &mdash; Professional Installation From $275</h1>
        <p>Fixed-price TV wall mounting, cable concealment, and Starlink installation for ${suburb.name} ${suburb.postcode} residents. Bracket included. 5-year warranty.</p>
    </div>
</section>

<!-- Area Introduction -->
<section>
    <div class="container">
        <div class="area-intro">
            <div class="area-content">
                <p class="section-label">Serving ${nameUpper} ${suburb.postcode}</p>
                <h2>Your Local TV Mounting Specialists in ${suburb.name}</h2>
                <p>${suburb.intro1}</p>
                <p>${suburb.intro2}</p>
                <a href="book.html" class="btn btn-primary">GET A QUOTE FOR ${nameUpper}</a>
            </div>
            <img src="img/${img(i0)}" alt="Professional TV wall mounting service in ${suburb.name}" loading="lazy">
        </div>

        <div class="area-stats">
            <div class="stat-card">
                <div class="stat-num">$275</div>
                <div class="stat-label">Starting Price (Inc GST)</div>
            </div>
            <div class="stat-card">
                <div class="stat-num">5yr</div>
                <div class="stat-label">Installation Warranty</div>
            </div>
            <div class="stat-card">
                <div class="stat-num">60min</div>
                <div class="stat-label">Average Install Time</div>
            </div>
        </div>
    </div>
</section>

<!-- Area Detail Content -->
<section style="background:#f8fafc;">
    <div class="container">
        <div class="area-body">
            <h2>TV Mounting for ${suburb.name} Homes</h2>
            <p>${suburb.h2body}</p>

            <h3>What We Offer ${suburb.name} Residents</h3>
            <ul>
                <li><strong>The Bedroom Package ($275 inc GST)</strong> &mdash; Flat or tilt bracket supplied and installed for screens 32&quot; to 55&quot;. Includes stud-located anchoring, laser levelling, and basic tuning and WiFi setup.</li>
                <li><strong>The Living Room Package ($385 inc GST)</strong> &mdash; Heavy-duty bracket for screens 56&quot; to 75&quot;. Includes two-technician safety lift for larger panels, secure Gyprock or stud-mounted installation, and full tuning.</li>
                <li><strong>The Cinema Package ($550 inc GST)</strong> &mdash; Extra-heavy bracket with reinforced anchoring for screens 76&quot; to 85&quot;. Two-technician installation with full picture calibration and audio setup.</li>
            </ul>

            <h3>Popular Add-Ons for ${suburb.name} Installations</h3>
            <ul>
                <li><strong>In-Wall Cable Concealment (+$99)</strong> &mdash; HDMI and power cables routed behind the plasterboard for a completely clean, floating look. Available for Gyprock cavity walls.</li>
                <li><strong>Full-Motion Arm Upgrade (+$120)</strong> &mdash; Swap the standard tilt bracket for a full-motion arm that extends, swivels, and tilts. Perfect for corner mounting or multi-angle viewing rooms.</li>
                <li><strong>Brick or Concrete Wall Mounting (+$55)</strong> &mdash; Masonry drilling and heavy-duty concrete anchors for solid wall surfaces.</li>
            </ul>
        </div>

        <!-- Photo Gallery -->
        <div class="area-gallery">
            <img src="img/${img(i1)}" alt="TV wall mounting installation in ${suburb.name} home" loading="lazy">
            <img src="img/${img(i2)}" alt="Professional TV bracket and cable management in ${suburb.name}" loading="lazy">
            <img src="img/${img(i3)}" alt="Completed TV installation in ${suburb.name} living room" loading="lazy">
        </div>

        <div class="area-body">
            <h3>Our Experience in ${suburb.name}</h3>
            <p>${suburb.experience}</p>

            <h3>${suburb.name} Installation Tip</h3>
            <p>${suburb.tip}</p>

            <h3>Why ${suburb.name} Residents Choose Brisbane TVs</h3>
            <p>${suburb.whyChoose}</p>
            <p>We understand that your home is your most valuable asset, and we treat every ${suburb.name} installation with the care and professionalism it deserves. From the moment we arrive in boot covers with drop sheets, to the final vacuum of plaster dust before we leave, our zero-mess policy ensures your home stays spotless throughout the process.</p>
        </div>

        <!-- CTA Banner -->
        <div class="area-cta">
            <h2>Ready to Book Your ${suburb.name} Installation?</h2>
            <p>Tell us about your TV and wall type, and Thomas will text you a confirmed price and available time slot within the hour.</p>
            <a href="book.html" class="btn btn-primary btn-lg">CHECK AVAILABILITY IN ${nameUpper}</a>
        </div>
    </div>
</section>

<!-- Google Reviews -->
<section>
    <div class="container" style="text-align:center;">
        <p class="section-label">Customer Reviews</p>
        <h2>What ${suburb.name} Residents Say About Us</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem;margin-top:2rem;text-align:left;">
            <div style="background:#fff;border-radius:12px;padding:2rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="color:#f59e0b;font-size:1.25rem;margin-bottom:0.75rem;">&starf;&starf;&starf;&starf;&starf;</div>
                <p style="font-style:italic;color:#475569;line-height:1.7;">&ldquo;Amazing service from Tom &mdash; came out same day to mount our 65&quot; TV and was done within an hour. Professional job, no fuss, at a great price.&rdquo;</p>
                <p style="font-weight:600;margin-top:1rem;color:#1e293b;">&mdash; Matt Gilroy</p>
            </div>
            <div style="background:#fff;border-radius:12px;padding:2rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="color:#f59e0b;font-size:1.25rem;margin-bottom:0.75rem;">&starf;&starf;&starf;&starf;&starf;</div>
                <p style="font-style:italic;color:#475569;line-height:1.7;">&ldquo;Tom from Rentek did an amazing job mounting our new tv on the wall and concealing the cables. So happy and would certainly recommend him for his prompt, professional service at a very reasonable price!&rdquo;</p>
                <p style="font-weight:600;margin-top:1rem;color:#1e293b;">&mdash; Amanda Sciortino</p>
            </div>
            <div style="background:#fff;border-radius:12px;padding:2rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="color:#f59e0b;font-size:1.25rem;margin-bottom:0.75rem;">&starf;&starf;&starf;&starf;&starf;</div>
                <p style="font-style:italic;color:#475569;line-height:1.7;">&ldquo;A zero fuss, professional service. Quoted, arrived, and installed within a couple of hours. Found him to be a friendly and outgoing guy and recommend him to anyone. Top shelf.&rdquo;</p>
                <p style="font-weight:600;margin-top:1rem;color:#1e293b;">&mdash; Scott Adams</p>
            </div>
        </div>
    </div>
</section>

<!-- Blog Section -->
<section class="blog-section">
    <div class="container">
        <p class="section-label">From the Blog</p>
        <h2>TV Mounting Tips &amp; Guides for ${suburb.name} Homeowners</h2>
        <p class="section-sub">Practical advice to help you get the most out of your home entertainment setup.</p>
        <div class="blog-grid">
            <div class="blog-card">
                <img src="img/${img(i4)}" alt="TV mounting height guide for ${suburb.name} homes" loading="lazy">
                <div class="blog-card-body">
                    <span class="blog-tag">Installation Guide</span>
                    <h3><a href="blog-what-height-mount-tv.html">What Height Should You Mount Your TV? The ${suburb.name} Homeowner's Guide</a></h3>
                    <p>The ideal TV mounting height depends on your seating position, screen size, and room layout. For most ${suburb.name} living rooms, the centre of the screen should sit at seated eye level &mdash; typically 100&ndash;110cm from the floor. Here's how to measure it for your space.</p>
                    <a href="blog-what-height-mount-tv.html" class="read-more">Read More &rarr;</a>
                </div>
            </div>
            <div class="blog-card">
                <img src="img/${img(i5)}" alt="Wall types guide for ${suburb.name} properties" loading="lazy">
                <div class="blog-card-body">
                    <span class="blog-tag">Wall Types</span>
                    <h3><a href="blog.html">Gyprock vs Brick: Which Wall Type Do You Have in ${suburb.name}?</a></h3>
                    <p>Not sure what your walls are made of? Most ${suburb.name} homes have Gyprock (plasterboard) on timber studs, but older properties may have brick veneer or double brick. Here's how to tell the difference and why it matters for your TV installation.</p>
                    <a href="blog.html" class="read-more">Read More &rarr;</a>
                </div>
            </div>
            <div class="blog-card">
                <img src="img/${img(i6)}" alt="Starlink internet installation in ${suburb.name}" loading="lazy">
                <div class="blog-card-body">
                    <span class="blog-tag">Smart Home</span>
                    <h3><a href="blog.html">Is Starlink Worth It in ${suburb.name}? A Local's Honest Review</a></h3>
                    <p>If your NBN connection in ${suburb.name} ${suburb.postcode} has been letting you down, Starlink could be the solution. We break down the real-world speeds, installation process, and whether it's worth the switch for your household.</p>
                    <a href="blog.html" class="read-more">Read More &rarr;</a>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Booking Form -->
<section class="booking" id="booking">
    <div class="container">
        <p class="section-label">Check Availability in ${suburb.name}</p>
        <h2>Book Your ${suburb.name} Installation</h2>

        <div class="booking-layout">
            <div class="booking-info">
                <h3>How It Works</h3>
                <p>Three simple steps to a perfectly mounted TV.</p>
                <div class="steps">
                    <div class="step">
                        <div class="step-num">1</div>
                        <span>Enter your details</span>
                    </div>
                    <div class="step">
                        <div class="step-num">2</div>
                        <span>Verify wall type</span>
                    </div>
                    <div class="step">
                        <div class="step-num">3</div>
                        <span>Secure your slot</span>
                    </div>
                </div>
            </div>

            <form class="booking-form" action="https://formsubmit.co/hello@brisbanetvs.com" method="POST">
                <input type="hidden" name="_subject" value="New Booking Request - ${suburb.name} - Brisbane TVs">
                <input type="hidden" name="_captcha" value="false">
                <input type="hidden" name="_next" value="">
                <div class="form-group">
                    <label for="fullname">Full Name</label>
                    <input type="text" id="fullname" name="fullname" placeholder="Your full name" required>
                </div>
                <div class="form-group">
                    <label for="mobile">Mobile Number</label>
                    <input type="tel" id="mobile" name="mobile" placeholder="04XX XXX XXX" required>
                </div>
                <div class="form-group">
                    <label for="email">Email Address</label>
                    <input type="email" id="email" name="email" placeholder="you@example.com" required>
                </div>
                <div class="form-group">
                    <label for="suburb">Suburb</label>
                    <input type="text" id="suburb" name="suburb" value="${suburb.name}" required>
                </div>
                <div class="form-group">
                    <label for="service">Service Needed</label>
                    <select id="service" name="service" required>
                        <option value="">Select Service...</option>
                        <option value="TV Wall Mounting">TV Wall Mounting</option>
                        <option value="Starlink Installation">Starlink Installation</option>
                        <option value="Soundbar / Audio">Soundbar / Audio</option>
                        <option value="Commercial Fit-out">Commercial Fit-out</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="tvsize">TV Size</label>
                    <select id="tvsize" name="tvsize" required>
                        <option value="">Select Size...</option>
                        <option value="Under 55 inches">Under 55&quot;</option>
                        <option value="55 - 75 inches">55&quot; - 75&quot;</option>
                        <option value="75+ inches">75&quot; +</option>
                        <option value="N/A (Starlink/Audio)">N/A (Starlink/Audio)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="wall">Wall Type</label>
                    <select id="wall" name="wall" required>
                        <option value="">Select Wall...</option>
                        <option value="Gyprock">Gyprock</option>
                        <option value="Brick / Concrete">Brick / Concrete</option>
                        <option value="Timber">Timber</option>
                        <option value="Unsure">Unsure</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="message">Message / Details</label>
                    <textarea id="message" name="message" placeholder="Any additional details about your installation..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-lg" style="width:100%;">Get My Fixed Price</button>
                <p class="form-disclaimer">By clicking you agree to be contacted via text or phone for a fixed price quote.</p>
            </form>
        </div>
    </div>
</section>

<!-- Nearby Suburbs -->
<section>
    <div class="container" style="text-align:center;">
        <p class="section-label">Nearby Service Areas</p>
        <h2>We Also Service These Suburbs Near ${suburb.name}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center;margin-top:2rem;">
${nearbyHtml(suburb)}
        </div>
    </div>
</section>

<!-- Footer -->
<footer>
    <div class="container">
        <div class="footer-grid">
            <div class="footer-brand">
                <div class="logo">BRISBANE <span>TVs</span></div>
                <p>Operated by Rentek. Professional AV and connectivity specialists serving the North Brisbane community with precision and integrity.</p>
                <div class="phone"><a href="tel:1300312271">1300 312 271</a></div>
                <p style="margin-top:0.5rem;"><a href="mailto:hello@brisbanetvs.com">hello@brisbanetvs.com</a></p>
            </div>
            <div>
                <h4>Company</h4>
                <ul>
                    <li><a href="index.html">Home</a></li>
                    <li><a href="services.html">Services &amp; FAQ</a></li>
                    <li><a href="about.html">About Us</a></li>
                    <li><a href="book.html">Contact &amp; Booking</a></li>
                </ul>
            </div>
            <div>
                <h4>Service Areas</h4>
                <div class="footer-suburbs">
${footerSuburbsHtml()}
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <span>&copy; 2026 Brisbane TVs. All rights reserved. Not a handyman. A Tech Specialist.</span>
            <span><a href="#">Privacy Policy</a> &nbsp;|&nbsp; <a href="#">Terms of Service</a></span>
        </div>
    </div>
</footer>

</body>
</html>`;
}

// ── Main ────────────────────────────────────────────────────────────
const outDir = path.resolve(__dirname);
let count = 0;

newSuburbs.forEach((suburb, index) => {
  const filePath = path.join(outDir, `${suburb.slug}.html`);
  const html = generatePage(suburb, index);
  fs.writeFileSync(filePath, html, 'utf8');
  count++;
  console.log(`[${count}/35] Generated: ${suburb.slug}.html`);
});

console.log(`\nDone! Generated ${count} area pages in ${outDir}`);
