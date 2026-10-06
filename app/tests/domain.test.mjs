import { passesHardFilters } from "../src/domain/filters.js";
import { paceScore } from "../src/domain/score.js";

const me = { seeking: "mulher", ageMin: 27, ageMax: 35, radiusKm: 15, sportMatters: false, hobbies: ["café"] };
const near = { id: "a", gender: "mulher", age: 29, km: 1.4 };
const far = { id: "b", gender: "mulher", age: 29, km: 40 };
const wrongGender = { id: "c", gender: "homem", age: 30, km: 2 };
const noSport = { id: "d", gender: "mulher", age: 30, km: 3, sport: "", hobbies: ["café"], intention: "namoro", lifestyleFit: 0.6 };

if (!passesHardFilters(me, near)) throw new Error("near should pass");
if (passesHardFilters(me, far)) throw new Error("distance is a hard filter");
if (passesHardFilters(me, wrongGender)) throw new Error("gender is a hard filter");
if (!passesHardFilters(me, noSport)) throw new Error("missing sport must not exclude");
const score = paceScore({ ...me, sport: "corrida", intention: "namoro" }, { ...noSport, intention: "namoro" });
if (score < 40) throw new Error("non-runner should still score");
console.log("domain ok", score);
