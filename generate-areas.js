const fs = require('fs');
const path = require('path');

const suburbs = [
  {
    name: "Banyo", slug: "banyo", postcode: "4014",
    desc: "a well-established suburb situated between the Gateway Motorway and the Brisbane Airport precinct",
    character: "Known for its mix of post-war homes and modern townhouses, Banyo is a suburb where families are upgrading their living spaces with larger screens and smarter home entertainment setups. The area's proximity to Westfield Chermside means residents have easy access to the latest TVs from JB Hi-Fi and Harvey Norman, but getting them professionally mounted is another story entirely.",
    housing: "Banyo homes typically feature a combination of brick and Gyprock internal walls, with many of the older fibro homes having been renovated with modern plasterboard interiors. The suburb's newer townhouse developments along Tufnell Road and St Vincents Road present unique mounting challenges, including shared walls and compact living areas where every centimetre counts.",
    local: "We've completed dozens of installations in Banyo, from compact 43-inch bedroom mounts in the townhouses near Banyo Village to full 75-inch cinema setups in the larger homes backing onto Nudgee Golf Club. Banyo residents particularly love our cable concealment service because the open-plan living areas in newer builds make dangling cables especially visible.",
    tip: "Many Banyo homes built in the 1960s and 70s have a mix of plaster and timber-lined walls. We always carry a multi-surface detection kit to identify the right anchoring method before we drill a single hole."
  },
  {
    name: "Nudgee", slug: "nudgee", postcode: "4014",
    desc: "a quiet, leafy suburb nestled between Boondall Wetlands and the Nudgee Golf Club",
    character: "Nudgee is one of Brisbane's hidden gems \u2014 a peaceful residential pocket with tree-lined streets and generous block sizes. Homes here tend to be well-maintained family residences where entertainment areas are a genuine focal point. Whether it's the footy on a Saturday afternoon or a family movie night, Nudgee residents value a quality home theatre experience.",
    housing: "The housing stock in Nudgee ranges from classic Queenslanders with VJ walls to modern rendered brick homes. Many properties along Nudgee Road and the surrounding streets have been extensively renovated, creating interesting wall combinations that require careful assessment before any TV installation. Timber VJ walls, in particular, need specialist stud-finding techniques that most handymen simply don't have.",
    local: "Our team has installed screens across Nudgee's diverse housing styles, from heritage homes where preserving the character of VJ walls was paramount, to brand-new builds where we've set up complete home theatre systems with concealed cabling and mounted soundbars. The larger lot sizes in Nudgee also mean many homes have dedicated media rooms \u2014 perfect for our Cinema package.",
    tip: "If you live in a raised Queenslander in Nudgee, the wall cavities can be deeper than standard. We carry extended cable routing hardware to ensure a clean concealment job regardless of wall depth."
  },
  {
    name: "Virginia", slug: "virginia", postcode: "4014",
    desc: "a compact residential suburb bordered by Schulz Canal and the industrial precinct along Robinson Road",
    character: "Virginia has transformed over recent years from a quiet, overlooked suburb into a popular choice for young families and first-home buyers. The area's affordability and proximity to the city have attracted a wave of renovators who are updating older homes with modern interiors \u2014 and a professionally mounted TV is often one of the first upgrades on the list.",
    housing: "Virginia's housing stock is predominantly post-war timber and brick homes, many of which have undergone internal renovations with new Gyprock walls. The suburb also has a growing number of duplex and townhouse developments, particularly around Zillmere Road, which feature lightweight construction that requires specific mounting techniques to support heavier screens safely.",
    local: "We've helped dozens of Virginia homeowners upgrade their living rooms with clean, professional TV installations. One of our most popular requests in this suburb is the full Living Room package with cable concealment \u2014 residents here are renovating their homes to a high standard and want the TV installation to match. We've also completed several Starlink installations for Virginia homes that suffer from patchy NBN coverage.",
    tip: "Virginia homes near the Schulz Canal can experience slightly higher humidity levels, which can affect plasterboard over time. We always check wall integrity before mounting and recommend reinforced anchoring if needed."
  },
  {
    name: "Northgate", slug: "northgate", postcode: "4013",
    desc: "a charming residential suburb with excellent train connectivity and a strong community atmosphere",
    character: "Northgate has become increasingly popular with professionals and young families who value its train station, leafy streets, and proximity to the city. The suburb has a wonderful mix of character homes and modern builds, creating a community where old and new coexist beautifully. Home entertainment is a big deal here \u2014 compact living spaces mean wall-mounted TVs are a practical necessity, not just an aesthetic choice.",
    housing: "From classic post-war cottages along Bowler Street to the modern apartments near the train station, Northgate offers a diverse range of wall types and mounting challenges. Many of the suburb's older homes have been renovated internally with Gyprock over original timber walls, which actually provides an excellent surface for TV mounting when done correctly.",
    local: "Northgate residents love the efficiency of our service \u2014 we're in and out within an hour for most standard installations. The suburb's proximity to our North Brisbane base means we can often offer same-day or next-day availability for Northgate bookings. We've completed everything from simple bedroom mounts in the apartments to elaborate living room setups with full-motion brackets and concealed cabling.",
    tip: "Many Northgate apartments have concrete walls behind the plasterboard. Our team carries masonry drill bits and concrete anchors as standard, so we're always prepared for whatever we find behind the Gyprock."
  },
  {
    name: "Nundah", slug: "nundah", postcode: "4012",
    desc: "one of Brisbane's oldest suburbs, featuring a vibrant village centre and a blend of heritage and modern homes",
    character: "Nundah has experienced a remarkable revitalisation over the past decade. The bustling Nundah Village, with its cafes, restaurants, and weekend markets, has made this suburb one of the most desirable in Brisbane's north. Residents here tend to be discerning about their home aesthetics, and a professionally mounted TV with concealed cables fits perfectly with the suburb's blend of character and modernity.",
    housing: "Nundah's housing ranges from beautifully restored Queenslanders on the hillside streets to sleek modern apartments in the village precinct. The older homes often feature VJ walls, ornate cornices, and timber frames that require specialised mounting approaches. Meanwhile, the newer apartment buildings along Sandgate Road present their own challenges with concrete core walls and strict body corporate requirements.",
    local: "We've become the go-to TV mounting service in Nundah, with many referrals coming through the local community Facebook groups. Our most requested service here is the Living Room package with cable concealment \u2014 Nundah residents invest heavily in their interior design and expect a showroom-quality finish. We've also handled several commercial installations for businesses along the Nundah Village strip.",
    tip: "If you're in one of Nundah's heritage-listed properties, we take extra care to minimise wall penetration and can offer surface-mounted cable management solutions that protect the home's character."
  },
  {
    name: "Toombul", slug: "toombul", postcode: "4012",
    desc: "a small but well-connected suburb known for its shopping precinct and easy access to major transport links",
    character: "Toombul sits at a strategic crossroads in Brisbane's north, making it one of the most accessible suburbs in the area. Despite its compact size, the suburb has a loyal residential community who appreciate its convenience and village feel. With the redevelopment of the Toombul precinct, there's a fresh wave of modern living in the area, and residents are keen to kit out their homes with the latest technology.",
    housing: "Toombul's housing is a mix of established brick homes, renovated post-war cottages, and newer apartment complexes. The suburb's flat terrain means most homes are single-storey, which simplifies TV installation logistics. Internal walls are predominantly Gyprock on timber frames, which is the ideal surface for our standard mounting packages.",
    local: "Our Toombul installations tend to be straightforward and efficient, which is why many residents here choose to add on cable concealment and soundbar mounting to make the most of our visit. We've recently completed several installations in the newer apartment developments near Toombul Shopping Centre, where space efficiency is key and wall-mounted TVs free up valuable floor area.",
    tip: "Toombul's proximity to the airport flight path means some residents have invested in premium soundbar setups to enhance their audio experience. We can mount your soundbar directly beneath your TV for the cleanest possible look."
  },
  {
    name: "Wavell Heights", slug: "wavell-heights", postcode: "4012",
    desc: "a large, family-friendly suburb spread across the hills north of Nundah, known for its quiet streets and strong community",
    character: "Wavell Heights is the quintessential Brisbane family suburb. With its generous block sizes, excellent schools, and friendly neighbourhood feel, it's no surprise that this area is home to some of our most enthusiastic customers. Weekend sport, family movie nights, and backyard entertaining are staples of life in Wavell Heights, and a properly mounted TV is central to the home entertainment experience.",
    housing: "The suburb features predominantly post-war brick and timber homes, many of which have been extensively renovated and extended over the decades. Wavell Heights homes often have large living areas with high ceilings, which provides excellent wall space for larger screens. The mix of rendered brick feature walls and Gyprock-lined rooms means we encounter a variety of mounting scenarios across the suburb.",
    local: "Wavell Heights is one of our busiest service areas. We've installed hundreds of TVs across the suburb, from modest 50-inch bedroom setups to impressive 85-inch cinema installations in dedicated media rooms. The suburb's family demographic means we often get booked for dual installations \u2014 a main living room screen plus a bedroom or kids' room mount \u2014 which we offer at a discounted rate.",
    tip: "Many Wavell Heights homes have rendered brick feature walls in the living room. Our brick mounting add-on includes specialist masonry anchors rated for screens up to 80kg, ensuring your TV stays put."
  },
  {
    name: "Chermside", slug: "chermside", postcode: "4032",
    desc: "the commercial and retail hub of Brisbane's north, anchored by Westfield Chermside and a thriving residential community",
    character: "Chermside is where most North Brisbane residents buy their TVs \u2014 JB Hi-Fi and Harvey Norman at Westfield Chermside sell thousands of screens every year. But buying the TV is the easy part. Getting it safely and beautifully mounted on your wall requires specialist skills, and that's exactly what Brisbane TVs provides. We're just minutes from Westfield, so we can often have your new TV mounted on the same day you purchase it.",
    housing: "Chermside's housing landscape has changed dramatically in recent years, with a surge of apartment and townhouse developments around the Westfield precinct. These modern builds typically feature a mix of lightweight Gyprock walls and occasional concrete structural walls. The established residential streets further from the shopping centre offer traditional brick and timber homes with more conventional mounting surfaces.",
    local: "As the closest suburb to most major electronics retailers, Chermside is our highest-volume service area. We've built strong relationships with several local retailers and frequently receive referrals. Our most common Chermside installation is in the newer apartment buildings, where we mount screens on Gyprock walls with full cable concealment to maintain the clean, modern aesthetic that apartment living demands.",
    tip: "Buying a new TV from Westfield Chermside? Call us before you leave the store and we can often schedule your installation for the same afternoon. We carry brackets for all sizes in our van, so there's no waiting."
  },
  {
    name: "Chermside West", slug: "chermside-west", postcode: "4032",
    desc: "a peaceful residential suburb just west of the Chermside commercial precinct, offering a quieter alternative to its bustling neighbour",
    character: "Chermside West offers all the convenience of being next to Westfield Chermside without the traffic and noise. This predominantly residential suburb is home to established families who take pride in their homes and value quality tradespeople. The suburb's elevation provides many homes with pleasant breezes and views, and residents here often have dedicated living and entertainment spaces that benefit from professional TV installation.",
    housing: "The housing in Chermside West is largely comprised of well-maintained brick and timber homes from the 1960s through to the 1980s, with many having undergone significant renovations. Internal walls are typically Gyprock on timber studs, which is our preferred mounting surface. Some homes in the suburb back onto parkland and have been extended with modern additions that include purpose-built media rooms.",
    local: "Chermside West residents tend to value a premium finish, and our most popular package here is the Living Room setup with the cable concealment add-on. We've also done several outdoor TV installations in Chermside West, mounting weatherproof screens on covered patios \u2014 perfect for watching the cricket while enjoying the afternoon breeze.",
    tip: "Chermside West homes with original 1970s brick veneer often have thicker-than-standard walls. We carry extra-long masonry bolts to ensure a rock-solid mount on these deeper brick surfaces."
  },
  {
    name: "Kedron", slug: "kedron", postcode: "4031",
    desc: "a well-regarded inner-north suburb known for its tree-lined streets, strong schools, and active community",
    character: "Kedron is one of Brisbane's most sought-after suburbs, prized for its central location, leafy character, and excellent amenities. The suburb attracts a mix of young professionals, growing families, and long-term residents who have watched the area evolve over decades. Kedron homeowners invest significantly in their properties, and a professionally installed home entertainment system is increasingly seen as a standard feature rather than a luxury.",
    housing: "Kedron's housing stock is a beautiful mix of Queenslanders, post-war homes, and contemporary builds. The older character homes along Leckie Road and Kedron Brook Road feature VJ walls and high ceilings that create stunning backdrops for wall-mounted TVs. The newer builds and renovations typically use standard Gyprock on timber or steel frames, which is straightforward for our team to work with.",
    local: "Kedron is one of our favourite suburbs to work in because the homes are so varied and the customers are so particular about quality. We've mounted screens above fireplaces, on exposed brick feature walls, and in custom media niches in this suburb. Kedron residents also frequently book our soundbar mounting service to complement their TV installation.",
    tip: "Many Kedron Queenslanders have been raised and built in underneath. If your TV is going on a ground-floor wall in a raised home, the wall construction may differ from the upper level. We always check both sides of the wall before committing to a mounting position."
  },
  {
    name: "Geebung", slug: "geebung", postcode: "4034",
    desc: "a suburban hub along the north train line, known for its convenience and family-oriented community",
    character: "Geebung is a practical, no-nonsense suburb that offers great value for families. With its own train station, easy access to Westfield Chermside, and a mix of affordable housing options, Geebung has become a popular choice for first-home buyers and young families building their dream entertainment setups. Many residents here are mounting their first big-screen TV and want it done right the first time.",
    housing: "Geebung's housing is predominantly post-war timber and fibro homes, many of which have been updated with modern interiors. The suburb also has a growing number of new builds and townhouse developments, particularly along Newman Road and Virginia Avenue. Internal walls in the older homes can vary from fibro sheeting to modern Gyprock, so a pre-installation wall assessment is essential.",
    local: "We've completed many first-time TV installations in Geebung, often for families upgrading from a TV unit to a wall-mounted setup. Our Bedroom package at $275 is extremely popular here, and many customers go on to book a second installation for their living room. Geebung's central location means we can usually offer morning or afternoon appointments on the same day.",
    tip: "Older Geebung homes with fibro wall linings require special care during installation. We use low-vibration drilling techniques and reinforced backing plates to ensure a safe, secure mount without damaging the surrounding wall surface."
  },
  {
    name: "Zillmere", slug: "zillmere", postcode: "4034",
    desc: "an evolving suburb in Brisbane's north, offering excellent value and growing infrastructure for families",
    character: "Zillmere is a suburb on the rise, with significant investment in infrastructure and community facilities making it an increasingly attractive option for homebuyers. The suburb's affordability has drawn a diverse and vibrant community, and as families settle in and make their homes their own, professional TV installation has become one of the most requested home improvement services in the area.",
    housing: "Zillmere features a mix of established fibro and timber homes alongside newer estate developments. The housing along Murphy Road and Handford Road includes some of the suburb's original post-war stock, while the developments around Zillmere Sports Centre are predominantly modern brick and Gyprock construction. This variety means our team needs to be prepared for different wall types on almost every job.",
    local: "Zillmere residents appreciate value for money, and our fixed-price packages are a perfect fit for the suburb's budget-conscious families. We've installed TVs throughout Zillmere's newer estates where the open-plan living designs make a wall-mounted TV the obvious choice. Our cable concealment add-on is particularly popular in these homes because the open floor plans leave nowhere to hide messy cables.",
    tip: "Several Zillmere developments use lightweight steel framing rather than timber studs. We carry specialist self-drilling metal stud anchors that provide a secure fixing point without the need for traditional timber noggins."
  },
  {
    name: "Boondall", slug: "boondall", postcode: "4034",
    desc: "a spacious suburb bordering the Boondall Wetlands, popular with families who value outdoor living and community events",
    character: "Boondall is famous for the Brisbane Entertainment Centre, but for local residents, the real entertainment happens at home. This family-oriented suburb features generous lot sizes, quiet cul-de-sacs, and homes designed for comfortable living. The proximity to the Boondall Wetlands gives the suburb a semi-rural feel despite being just 15 kilometres from the CBD, and residents here invest in creating comfortable, well-equipped homes.",
    housing: "Boondall's housing stock is predominantly brick and tile homes from the 1980s and 1990s, with good-sized living areas perfect for larger TV installations. Many homes feature internal brick feature walls in living rooms, which are ideal for mounting heavier screens with our brick mounting add-on. The suburb's newer developments along Netherby Street and the surrounding streets offer modern Gyprock interiors.",
    local: "Boondall is popular for our Cinema package installations, thanks to the suburb's larger living rooms that can accommodate 75-inch-plus screens. We've also completed several Starlink installations here for homes on the suburb's western edge, where NBN coverage can be patchy due to the area's proximity to the wetlands and the distance from the nearest exchange.",
    tip: "Boondall's brick homes from the 1980s era often have cavity brick construction. We use through-bolt anchoring systems that penetrate both brick layers for maximum holding strength \u2014 essential for screens over 65 inches."
  },
  {
    name: "Taigum", slug: "taigum", postcode: "4018",
    desc: "a growing suburb in Brisbane's far north, centred around the popular Taigum Square shopping village",
    character: "Taigum is a suburban success story \u2014 once a quiet outer suburb, it has grown into a bustling residential area with excellent local amenities. Taigum Square provides convenient shopping, and the suburb's residential streets are filled with families who are building comfortable, well-equipped homes. The demand for professional TV installation in Taigum has grown steadily as the suburb's population has increased.",
    housing: "Taigum is predominantly comprised of modern brick and tile homes from the 1990s onwards, along with several newer estate developments featuring contemporary designs. The housing here is generally well-suited to TV installation, with standard Gyprock internal walls and good access to wall cavities for cable concealment. Many homes have open-plan living and dining areas that benefit enormously from a wall-mounted TV.",
    local: "Taigum families love our package deals, with many booking a living room installation and adding a bedroom mount at a discounted rate. The suburb's newer homes are particularly easy to work with, and we can often complete a full installation with cable concealment in under 90 minutes. We've also installed several outdoor entertainment setups on covered patios in Taigum.",
    tip: "Taigum's modern estates often have recessed wall niches designed for TVs. We can custom-mount within these niches using adjustable brackets that allow you to angle the screen for optimal viewing from your sofa position."
  },
  {
    name: "Fitzgibbon", slug: "fitzgibbon", postcode: "4018",
    desc: "a master-planned community in Brisbane's north, known for its modern infrastructure and sustainable design",
    character: "Fitzgibbon Chase is one of Brisbane's most successful urban renewal projects, transforming former defence land into a thriving residential community. The suburb is characterised by modern, energy-efficient homes built to contemporary standards. Residents here are typically tech-savvy and expect their home entertainment setup to match the modern, clean aesthetic of their homes.",
    housing: "As a relatively new suburb, Fitzgibbon's housing stock is almost entirely modern construction. Homes feature standard Gyprock on timber or steel frames, open-plan living areas, and well-designed entertainment spaces. The uniform construction quality across the suburb means our installations here are consistently efficient and the results are always clean and professional.",
    local: "Fitzgibbon is one of our most straightforward suburbs to service, and our team loves working here. The modern construction means fewer surprises behind the walls, and the homes' open-plan designs make our installations look spectacular. The Living Room package with cable concealment is by far our most popular option in Fitzgibbon, and many residents add a soundbar mount to complete the setup.",
    tip: "Fitzgibbon homes built after 2015 typically include pre-wired conduits for wall-mounted TVs. Ask your builder for the conduit location before booking \u2014 it can save time and ensure a perfect cable concealment result."
  },
  {
    name: "Carseldine", slug: "carseldine", postcode: "4034",
    desc: "a leafy northern suburb undergoing exciting transformation with the Carseldine Village development",
    character: "Carseldine is at an exciting crossroads, with the former QUT campus being redeveloped into the Carseldine Village precinct while the established residential areas maintain their quiet, family-friendly charm. The suburb's excellent transport links, including its own train station and proximity to Gympie Road, make it one of the most accessible suburbs in Brisbane's north. Residents here value quality and convenience in equal measure.",
    housing: "Carseldine's established areas feature well-maintained brick and tile homes from the 1970s through to the 1990s, many with large living rooms perfect for cinema-sized TV installations. The suburb's newer pockets include modern townhouses and low-rise apartments. Internal wall types vary from original plaster and brick veneer to renovated Gyprock, so we always conduct a thorough wall assessment before installation.",
    local: "Carseldine has been one of our core service areas since we started, and we've built a strong reputation through word-of-mouth recommendations in the suburb. We frequently install for families upgrading their main living room TV, and the suburb's larger homes mean we regularly install our Cinema package for screens up to 85 inches. Carseldine is also a popular area for our Starlink service.",
    tip: "The original Carseldine homes built in the 1970s often feature double-brick construction in the living room. While this provides an incredibly strong mounting surface, it does require diamond-tipped masonry bits and heavy-duty anchors \u2014 both of which we carry as standard."
  },
  {
    name: "Aspley", slug: "aspley", postcode: "4034",
    desc: "a large, well-established suburb in Brisbane's north, centred around the Aspley Hypermarket shopping precinct",
    character: "Aspley is one of Brisbane's biggest and most established northern suburbs, with a population that takes home entertainment seriously. The suburb's size and diversity mean we see everything from first-time TV mounts for young renters to elaborate multi-room installations for long-term homeowners. The Aspley Hypermarket, Aspley Hornets, and excellent local schools all contribute to a strong community feel.",
    housing: "Aspley's vast residential area encompasses a huge range of housing types. The western side near Rode Road features many original brick homes, while the eastern side towards Robinson Road includes newer estates and townhouse developments. Aspley homes typically have spacious living areas, and the suburb's mature trees and established gardens often extend to well-maintained interiors that demand a professional-quality TV installation.",
    local: "Aspley is one of our highest-volume suburbs, and we've installed in almost every street across this sprawling area. We frequently do multiple installations per day in Aspley, which allows us to offer excellent availability to local residents. Our brick wall mounting add-on is particularly popular here due to the prevalence of brick feature walls in the suburb's established homes.",
    tip: "Aspley's large homes often have multiple potential mounting positions in each room. We're happy to spend a few minutes helping you choose the optimal height, angle, and wall position for your screen based on your furniture layout and viewing distance."
  },
  {
    name: "Hendra", slug: "hendra", postcode: "4011",
    desc: "an upmarket inner-north suburb known for the Hendra Racecourse, tree-lined avenues, and beautifully renovated homes",
    character: "Hendra is one of Brisbane's most prestigious northern suburbs, where character homes sit alongside stunning contemporary builds. The suburb's residents have high expectations when it comes to home presentation, and a TV installation needs to meet the same standard as the rest of the home. This is where our 'showroom finish' approach really comes into its own \u2014 no visible cables, no mess, and no compromises.",
    housing: "Hendra's housing stock is a premium mix of beautifully restored Queenslanders, art deco homes, and architect-designed contemporary residences. The older homes feature VJ walls, ornate timber details, and high ceilings that create dramatic settings for wall-mounted TVs. The newer builds often include bespoke media walls, integrated cabinetry, and pre-wired conduits specifically designed for flat-screen installations.",
    local: "Hendra installations tend to be at the premium end of our service range, with most customers opting for full cable concealment, full-motion brackets, and soundbar mounting. We take particular care in Hendra homes because the interiors are often designed by professional stylists, and our work needs to integrate seamlessly with the existing aesthetic. We've mounted screens on everything from heritage VJ walls to custom marble feature walls in this suburb.",
    tip: "For Hendra's character homes with ornate VJ walls and picture rails, we offer a heritage-sensitive mounting approach that minimises wall penetration and uses existing wall features to route cables discreetly."
  },
  {
    name: "Clayfield", slug: "clayfield", postcode: "4011",
    desc: "a prestigious inner-north suburb known for its elegant Queenslanders, leafy streets, and proximity to the city",
    character: "Clayfield exudes a refined suburban elegance that few Brisbane suburbs can match. The wide, tree-lined streets, heritage homes, and proximity to the CBD have made Clayfield a favourite among professionals and families who appreciate quality in every aspect of their home. When Clayfield residents invest in a new television, they expect the installation to be executed with the same attention to detail as the rest of their carefully curated home.",
    housing: "Clayfield is dominated by grand Queenslanders and character homes, many of which are heritage-listed or character-protected. These homes feature high ceilings, VJ walls, and beautiful timber details that require a thoughtful approach to TV installation. The suburb also includes high-end apartment developments along Sandgate Road, where concrete walls and body corporate regulations add complexity to the mounting process.",
    local: "Our Clayfield installations are among our most meticulous. We've mounted screens in heritage living rooms where minimising wall impact was essential, and in modern penthouses where the TV needed to sit perfectly flush against custom wall finishes. Clayfield customers consistently choose our premium options including full-motion brackets, cable concealment, and soundbar mounting.",
    tip: "Clayfield's grand Queenslanders often have double-height living spaces on the ground floor. For elevated mounting positions above 2.4 metres, we bring telescopic scaffolding for safe and precise installation \u2014 no ladders leaning against your walls."
  },
  {
    name: "Wooloowin", slug: "wooloowin", postcode: "4030",
    desc: "a charming inner-north suburb with a village atmosphere, beautiful character homes, and excellent connectivity",
    character: "Wooloowin is one of Brisbane's most characterful northern suburbs, with its compact village feel, heritage homes, and walkable streets creating a community that values both tradition and quality. The suburb's residents are discerning homeowners who maintain their properties to a high standard and expect the same level of care from any tradesperson who enters their home.",
    housing: "Wooloowin's housing is predominantly character homes \u2014 Queenslanders, workers' cottages, and art deco residences that have been beautifully maintained or renovated. Internal walls vary from original VJ timber to modern Gyprock, and many homes feature a combination of both where renovations have extended the original footprint. The suburb's apartment stock along Lutwyche Road adds modern concrete and Gyprock surfaces to our installation repertoire.",
    local: "Wooloowin residents consistently rank among our most satisfied customers because they appreciate the care we take with their homes. We've completed installations in some of the suburb's most beautiful heritage homes, always taking the time to understand the homeowner's vision and executing the installation with surgical precision. Our cable concealment service is particularly valued in Wooloowin, where exposed cables would clash with the carefully maintained heritage aesthetic.",
    tip: "Wooloowin's character homes often have picture rails running around the living room at approximately 2.1 metres. We can mount your TV at the optimal viewing height just below the picture rail, using the rail itself as a discreet cable management channel."
  }
];

const images = [
  { file: 'hero-banner.jpg', alt: 'Brisbane TVs professional TV wall mounting service' },
  { file: 'tv-soundbar-mount.jpg', alt: 'Wall mounted TV with soundbar installation' },
  { file: 'tv-above-fireplace.jpg', alt: 'TV mounted above fireplace with hidden cables' },
  { file: 'living-room-mount.jpg', alt: 'Large screen TV mounted in living room' },
  { file: 'clean-wall-mount.jpg', alt: 'Clean TV wall mount with soundbar' },
  { file: 'apartment-install.jpg', alt: 'Modern apartment TV installation' },
  { file: 'tech-installing.jpg', alt: 'Brisbane TVs technician installing large screen' },
  { file: 'bracket-closeup.jpg', alt: 'Heavy duty TV mounting bracket close-up' },
  { file: 'before-after.png', alt: 'Before and after TV wall mounting comparison' }
];

function getImg(index) {
  return images[index % images.length];
}

function generatePage(suburb, index) {
  const img1 = getImg(index);
  const img2 = getImg(index + 1);
  const img3 = getImg(index + 2);
  const img4 = getImg(index + 3);
  const img5 = getImg(index + 4);

  const otherSuburbs = suburbs.filter(s => s.slug !== suburb.slug);
  const nearby = otherSuburbs.slice(0, 5);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TV Wall Mounting ${suburb.name} | Brisbane TVs | From $275</title>
    <meta name="description" content="Professional TV wall mounting in ${suburb.name} ${suburb.postcode}. Fixed-price packages from $275. Bracket included. Cable concealment available. 5-year warranty. Book today.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
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
        <h1>Professional TV Installation in ${suburb.name}</h1>
        <p>Fixed-price TV wall mounting, cable concealment, and Starlink installation for ${suburb.name} ${suburb.postcode} residents. Bracket included. 5-year warranty.</p>
    </div>
</section>

<!-- Area Introduction -->
<section>
    <div class="container">
        <div class="area-intro">
            <div class="area-content">
                <p class="section-label">Serving ${suburb.name.toUpperCase()} ${suburb.postcode}</p>
                <h2>Your Local TV Mounting Specialists in ${suburb.name}</h2>
                <p>${suburb.name} is ${suburb.desc}. Brisbane TVs is proud to serve this community with professional, fixed-price TV wall mounting and technology installation services that residents can trust.</p>
                <p>${suburb.character}</p>
                <a href="book.html" class="btn btn-primary">GET A QUOTE FOR ${suburb.name.toUpperCase()}</a>
            </div>
            <img src="img/${img1.file}" alt="${img1.alt} in ${suburb.name}" loading="lazy">
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
            <p>${suburb.housing}</p>

            <h3>What We Offer ${suburb.name} Residents</h3>
            <ul>
                <li><strong>The Bedroom Package ($275 inc GST)</strong> &mdash; Flat or tilt bracket supplied and installed for screens 32" to 55". Includes stud-located anchoring, laser levelling, and basic tuning and WiFi setup.</li>
                <li><strong>The Living Room Package ($385 inc GST)</strong> &mdash; Heavy-duty bracket for screens 56" to 75". Includes two-technician safety lift for larger panels, secure Gyprock or stud-mounted installation, and full tuning.</li>
                <li><strong>The Cinema Package ($550 inc GST)</strong> &mdash; Extra-heavy bracket with reinforced anchoring for screens 76" to 85". Two-technician installation with full picture calibration and audio setup.</li>
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
            <img src="img/${img2.file}" alt="${img2.alt}" loading="lazy">
            <img src="img/${img3.file}" alt="${img3.alt}" loading="lazy">
            <img src="img/${img4.file}" alt="${img4.alt}" loading="lazy">
        </div>

        <div class="area-body">
            <h3>Our Experience in ${suburb.name}</h3>
            <p>${suburb.local}</p>

            <h3>${suburb.name} Installation Tip</h3>
            <p>${suburb.tip}</p>

            <h3>Why ${suburb.name} Residents Choose Brisbane TVs</h3>
            <p>When you book with Brisbane TVs, you're not getting a general handyman with a drill and a YouTube tutorial. You're getting a trained technology specialist who arrives with a fully stocked van, commercial-grade equipment, and the expertise to handle any wall type or screen size. Every installation is laser-levelled, stud-anchored where possible, and backed by our 5-year workmanship warranty.</p>
            <p>We understand that your home is your most valuable asset, and we treat every ${suburb.name} installation with the care and professionalism it deserves. From the moment we arrive in boot covers with drop sheets, to the final vacuum of plaster dust before we leave, our zero-mess policy ensures your home stays spotless throughout the process.</p>
        </div>

        <!-- CTA Banner -->
        <div class="area-cta">
            <h2>Ready to Book Your ${suburb.name} Installation?</h2>
            <p>Tell us about your TV and wall type, and Thomas will text you a confirmed price and available time slot within the hour.</p>
            <a href="book.html" class="btn btn-primary btn-lg">CHECK AVAILABILITY IN ${suburb.name.toUpperCase()}</a>
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
                <img src="img/${img5.file}" alt="${img5.alt}" loading="lazy">
                <div class="blog-card-body">
                    <span class="blog-tag">Installation Guide</span>
                    <h3><a href="#">What Height Should You Mount Your TV? The ${suburb.name} Homeowner's Guide</a></h3>
                    <p>The ideal TV mounting height depends on your seating position, screen size, and room layout. For most ${suburb.name} living rooms, the centre of the screen should sit at seated eye level \u2014 typically 100\u2013110cm from the floor. Here's how to measure it for your space.</p>
                    <a href="#" class="read-more">Read More &rarr;</a>
                </div>
            </div>
            <div class="blog-card">
                <img src="img/${getImg(index + 5).file}" alt="${getImg(index + 5).alt}" loading="lazy">
                <div class="blog-card-body">
                    <span class="blog-tag">Wall Types</span>
                    <h3><a href="#">Gyprock vs Brick: Which Wall Type Do You Have in ${suburb.name}?</a></h3>
                    <p>Not sure what your walls are made of? Most ${suburb.name} homes have Gyprock (plasterboard) on timber studs, but older properties may have brick veneer or double brick. Here's how to tell the difference and why it matters for your TV installation.</p>
                    <a href="#" class="read-more">Read More &rarr;</a>
                </div>
            </div>
            <div class="blog-card">
                <img src="img/${getImg(index + 6).file}" alt="${getImg(index + 6).alt}" loading="lazy">
                <div class="blog-card-body">
                    <span class="blog-tag">Smart Home</span>
                    <h3><a href="#">Is Starlink Worth It in ${suburb.name}? A Local's Honest Review</a></h3>
                    <p>If your NBN connection in ${suburb.name} ${suburb.postcode} has been letting you down, Starlink could be the solution. We break down the real-world speeds, installation process, and whether it's worth the switch for your household.</p>
                    <a href="#" class="read-more">Read More &rarr;</a>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Nearby Suburbs -->
<section>
    <div class="container" style="text-align:center;">
        <p class="section-label">Nearby Service Areas</p>
        <h2>We Also Service These Suburbs Near ${suburb.name}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center;margin-top:2rem;">
${nearby.map(s => `            <a href="${s.slug}.html" class="btn btn-outline" style="font-size:0.9rem;padding:0.6rem 1.25rem;">${s.name}</a>`).join('\n')}
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
${suburbs.map(s => `                    <a href="${s.slug}.html">${s.name}</a>`).join('\n')}
                </div>
                <p style="font-size:0.8rem;color:#64748b;margin-top:1rem;">Don't see your suburb? Check availability on our booking form. We service within 30km of North Brisbane.</p>
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

// Generate all area pages
suburbs.forEach((suburb, index) => {
  const html = generatePage(suburb, index);
  const filePath = path.join(__dirname, `${suburb.slug}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`Created: ${suburb.slug}.html`);
});

console.log(`\nGenerated ${suburbs.length} area pages.`);
