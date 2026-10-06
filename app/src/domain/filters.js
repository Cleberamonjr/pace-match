export function passesHardFilters(me, other, blocked = []) {
  if (blocked.includes(other.id)) return false;
  if (me.seeking && me.seeking !== "todos" && other.gender !== me.seeking) return false;
  if (other.age < me.ageMin || other.age > me.ageMax) return false;
  if (other.km > me.radiusKm) return false;
  return true;
}

export function toPublicProfile(other) {
  return {
    id: other.id,
    name: other.name,
    age: other.age,
    gender: other.gender,
    km: other.km,
    area: other.area,
    bio: other.bio,
    hobbies: other.hobbies,
    sport: other.sport,
    frequency: other.frequency,
    photo: other.photo
  };
}
