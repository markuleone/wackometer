# Generates the word data for Wordstorm (freestyle word generator) and the /rhymes/ search pages.
# Run once when the word pool changes:
#   pip install pronouncing wordfreq && npm i --no-save word-list@4.1.0
#   WORDLIST=node_modules/word-list/words.txt python3 scripts/gen-words.py
# Outputs are committed, so the normal build never needs Python.
import json, re, pronouncing, wordfreq

THEMES = {
  "Everyday": "phone charger receipt laundry hoodie sneakers backpack keys wallet mirror pillow blanket couch fridge microwave toaster kettle mug spoon fork plate sink faucet window curtain ceiling doorbell mailbox driveway garage ladder bucket candle lighter match battery headphones speaker remote sofa carpet closet drawer hanger zipper button pocket sticker magnet calendar clock alarm notebook pencil eraser stapler envelope stamp ticket coupon",
  "City": "subway taxi bus corner bodega sidewalk crosswalk billboard rooftop alley parking meter siren traffic bridge tunnel skyline tower elevator lobby hallway laundromat pharmacy diner arcade stadium highway exit ramp gas station motel neon pigeon fire hydrant streetlight scaffold dumpster graffiti",
  "Food": "pizza noodles ramen taco burrito pickle lemon cherry mango peach waffle pancake syrup biscuit gravy butter honey pepper garlic onion cereal popcorn pretzel cookie donut bagel toast sandwich soda coffee espresso milkshake smoothie candy chocolate caramel vanilla ketchup mustard salsa nachos dumpling",
  "Nature": "river ocean wave thunder lightning tornado hurricane desert canyon mountain valley meadow forest willow cactus pebble boulder island glacier volcano comet planet meteor moonlight sunrise sunset puddle mud dandelion clover thorn rose ivy maple acorn feather",
  "Animals": "tiger lion wolf fox coyote raccoon possum squirrel pigeon crow raven owl eagle falcon hawk shark whale dolphin octopus jellyfish turtle snake lizard gecko frog spider beetle hornet butterfly moth puppy kitten pony donkey goat camel panda",
  "Flex": "diamond chain gold silver crown throne trophy medal jackpot lottery bankroll yacht mansion penthouse limo jet runway sneaker drop vault safe briefcase champagne caviar velvet marble ice drip sauce wave boss legend icon",
  "Feelings without saying it": "goosebumps shiver sweat heartbeat blush grin smirk shrug sigh yawn hiccup stutter whisper mumble scream giggle sob frown wink nod fidget pace knuckles clench tremble flinch",
  "Wildcards": "astronaut pirate ninja cowboy wizard vampire zombie robot ghost alien mermaid dragon unicorn detective magician clown referee lifeguard janitor mailman barber dentist surgeon tattoo lasso boomerang trampoline volcano submarine helicopter skateboard bicycle scooter tractor bulldozer",
}

import os, sys
DICT = set(open(os.environ.get("WORDLIST", "dict.txt")).read().split())  # npm word-list words.txt: dictionary words, no proper nouns
NAMES = set("maria michael lisa nero meyer shapiro francisco korea jose diego mario santa juan anna tina rita sara gina dina nina lena carlos pedro maya mia ella bella emma luna jimmy johnny bobby billy tommy danny kenny larry harry jerry terry gary mary barry sally kelly holly molly polly dolly katie cody brody jody rocky tony bailey anglo geneva quixote marina visa".split())
top = [w for w in wordfreq.top_n_list("en", 60000) if w in DICT and w not in NAMES]
rank = {w: i for i, w in enumerate(top)}
BAD = set("""fuck shit bitch cunt dick piss ass cock wank whore slut porn pussy penis vagina cum dildo twat nigga nigger fag faggot dyke chink spic kike retard tranny""".split())
LAZY = [["fire","desire","higher","liar"],["heart","apart","start","part"],["love","above","of","dove"],["night","light","tonight","right","bright","fight","sight"],["pain","rain","again","insane","chain"],["cry","die","sky","why","fly","goodbye","lie","try","eye","high"],["true","you","through","blue","new","do"],["me","free","be","see","sea","need"],["go","know","so","show","slow","grow"],["away","stay","day","say","way","okay","pray"],["eyes","lies","skies","cries","goodbyes","rise"],["soul","whole","control","hole","goal"],["alone","home","phone","own","stone"],["mind","find","behind","kind","blind"],["time","mine","fine","line","shine","sign"]]
LAZYSET = {w for g in LAZY for w in g}

def ok(w, base):
  return w.isalpha() and w in rank and rank[w] < 25000 and w != base and w not in BAD and len(w) > 1 and not (len(w) > 3 and (w.startswith(base) or base.startswith(w)))

def phones(w):
  p = pronouncing.phones_for_word(w)
  return p[0] if p else None

def skeleton(ph):
  rp = pronouncing.rhyming_part(ph)
  vs = [re.sub(r"\d", "", x) for x in rp.split() if re.search(r"\d", x)]
  last = rp.split()[-1]
  tail = "V" if re.search(r"\d", last) else ("S" if re.sub(r"\d", "", last) in {"S","Z","SH","ZH","F","V","TH","DH","HH"} else "N" if last in {"M","N","NG"} else "T")
  return " ".join(vs) + "|" + tail

# near-rhyme index over common words
SK = {}
for w in top[:25000]:
  if not w.isalpha() or w in BAD: continue
  ph = phones(w)
  if ph: SK.setdefault(skeleton(ph), []).append(w)

def rhymes_for(w, n_perfect=60, n_near=30):
  ph = phones(w)
  if not ph: return None
  perfect = sorted({r for r in pronouncing.rhymes(w) if ok(r, w)}, key=lambda r: rank[r])[:n_perfect]
  pset = set(perfect)
  near = [r for r in SK.get(skeleton(ph), []) if ok(r, w) and r not in pset][:n_near]
  syl = pronouncing.syllable_count(ph)
  sc = lambda r: pronouncing.syllable_count(phones(r))
  return {"perfect": perfect, "near": near, "syl": syl, "psyl": [sc(r) for r in perfect]}

themes, client_rhymes, pages = {}, {}, {}
for t, s in THEMES.items():
  ws = []
  for w in s.split():
    if w in ws: continue
    ws.append(w)
    r = rhymes_for(w)
    if not r: continue
    pick = [x for x in r["perfect"] if x not in LAZYSET][:5]
    if len(pick) < 4: pick += [x for x in r["near"] if x not in pick][: 4 - len(pick) + 1]
    if pick: client_rhymes[w] = pick[:5]
    pages[w] = r
  themes[t] = ws

# extra rhyme pages for words people search a lot (the lazy ones get extra advice on the page)
for w in sorted(LAZYSET | set("baby money crazy forever summer winter tomorrow yesterday party city girl boy song beat street dream road car friend story".split())):
  if w not in pages:
    r = rhymes_for(w)
    if r: pages[w] = r

json.dump({"themes": themes, "rhymes": client_rhymes}, open("web/data/words.json", "w"), separators=(",", ":"))
json.dump({"pages": pages, "lazy": LAZY}, open("scripts/rhyme-pages.json", "w"), separators=(",", ":"))
print("themes", {k: len(v) for k, v in themes.items()}, "client rhymes", len(client_rhymes), "pages", len(pages))
