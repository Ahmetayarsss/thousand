# -*- coding: utf-8 -*-
"""Çok anlamlı kelimeler için her anlama bir örnek cümle.

Anahtar: (grup_no, kelime)  →  [cümle, ...]  (her cümlede <b>kelime</b>).
build_all.apply_multi_examples bunu tüm gruplara uygular (100-kelime kısıtı yok;
Grup 1/10 gibi enrich'siz gruplar da dahil). Sıra = tr alanındaki anlam sırası.
"""

EX = {
 # ——— Grup 1 (A1) ———
 (1, "live"): ["They <b>live</b> in a small village.", "The concert was shown <b>live</b> on TV."],
 (1, "will"): ["I <b>will</b> call you tomorrow.", "She has a strong <b>will</b> to win."],
 (1, "opposite"): ["'Hot' is the <b>opposite</b> of 'cold'.", "The bank is <b>opposite</b> the school."],
 (1, "course"): ["I'm taking an English <b>course</b>.", "The ship changed its <b>course</b>.", "The main <b>course</b> was chicken."],
 (1, "off"): ["Please turn <b>off</b> the light.", "The island is far <b>off</b> the coast."],
 (1, "shower"): ["I take a <b>shower</b> every morning.", "We got caught in a <b>shower</b> of rain."],
 (1, "introduce"): ["Let me <b>introduce</b> my friend Ali.", "The school will <b>introduce</b> a new rule."],
 (1, "when"): ["<b>When</b> does the film start?", "Call me <b>when</b> you arrive."],
 (1, "open"): ["The shop is <b>open</b> until nine.", "Please <b>open</b> the window."],
 (1, "match"): ["We watched the football <b>match</b>.", "He lit a <b>match</b> to start the fire.", "Your socks don't <b>match</b>."],
 (1, "space"): ["There isn't much <b>space</b> in my room.", "Astronauts travel in <b>space</b>."],
 (1, "paint"): ["The <b>paint</b> is still wet.", "They will <b>paint</b> the wall blue."],
 (1, "play"): ["The children <b>play</b> in the park.", "We saw a <b>play</b> at the theatre."],
 (1, "love"): ["I <b>love</b> Italian food.", "Their <b>love</b> lasted a lifetime."],
 (1, "show"): ["Can you <b>show</b> me the way?", "We watched a TV <b>show</b>."],
 (1, "second"): ["Wait a <b>second</b>, please.", "She came <b>second</b> in the race."],
 (1, "subject"): ["My favourite <b>subject</b> is maths.", "In this sentence, 'dog' is the <b>subject</b>.", "The plan is <b>subject</b> to change."],
 (1, "right"): ["You gave the <b>right</b> answer.", "Turn <b>right</b> at the corner.", "Everyone has the <b>right</b> to vote."],
 (1, "welcome"): ["<b>Welcome</b> to our home!", "They came out to <b>welcome</b> the guests."],
 (1, "spring"): ["Flowers bloom in <b>spring</b>.", "The <b>spring</b> in the pen is broken.", "Fresh water flowed from the <b>spring</b>."],
}
