// Author / reviewer entities power the bylines and Person/Organization schema
// that search engines and LLMs use as E-E-A-T (experience, expertise,
// authority, trust) signals.
//
// IMPORTANT for launch: real E-E-A-T needs real, verifiable people. The default
// author below is the brand's editorial team (an honest Organization-level
// byline). Before publishing at scale, add genuine named experts with real
// credentials and link their profiles — do not invent fake individuals.

export const authors = {
  editorial: {
    id: 'editorial',
    name: 'The Dwellwise Editorial Team',
    type: 'Organization',
    role: 'Reviews & Research',
    // Honest team-level bio. Reads as a trust signal without impersonating a
    // specific person.
    bio:
      'The Dwellwise editorial team researches, buys and lives with home ' +
      'technology so you do not have to. Every recommendation is the result of ' +
      'hands-on testing, structured scoring and independent research — never a ' +
      'manufacturer’s spec sheet alone.',
    expertise: [
      'Smart home devices',
      'Home security',
      'Home networking',
      'Product testing methodology'
    ],
    url: '/about'
  }
};

export const defaultAuthor = 'editorial';

export function getAuthor(id) {
  return authors[id] || authors[defaultAuthor];
}

export default authors;
