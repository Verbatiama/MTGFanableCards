import { CardDatabase } from '../../src/data/card-database.js';
import { scryfallCard } from './helpers.js';

/**
 * A small card database for the CLI and API tests: two Lightning Bolt
 * printings, a double-faced card and a split card (out of scope for v1).
 */
export function deckDatabase() {
  return CardDatabase.build([
    scryfallCard({
      name: 'Lightning Bolt',
      mana_cost: '{R}',
      colors: ['R'],
      oracle_text: 'Lightning Bolt deals 3 damage to any target.',
    }),
    scryfallCard({
      name: 'Lightning Bolt',
      set: 'm10',
      collector_number: '146',
      released_at: '2009-07-17',
      mana_cost: '{R}',
      colors: ['R'],
    }),
    scryfallCard({
      name: 'Delver of Secrets // Insectile Aberration',
      layout: 'transform',
      type_line: 'Creature — Human Wizard // Creature — Human Insect',
      card_faces: [
        {
          name: 'Delver of Secrets',
          mana_cost: '{U}',
          type_line: 'Creature — Human Wizard',
          colors: ['U'],
          power: '1',
          toughness: '1',
          oracle_text: '',
          image_uris: {
            art_crop:
              'https://cards.scryfall.io/art_crop/front/1/1/11bf83bb-c95b-4b4f-9a56-ce7a1816307a.jpg?1',
          },
        },
        {
          name: 'Insectile Aberration',
          mana_cost: '',
          type_line: 'Creature — Human Insect',
          colors: ['U'],
          power: '3',
          toughness: '2',
          oracle_text: 'Flying',
          image_uris: {
            art_crop:
              'https://cards.scryfall.io/art_crop/back/1/1/11bf83bb-c95b-4b4f-9a56-ce7a1816307a.jpg?1',
          },
        },
      ],
    }),
    scryfallCard({
      name: 'Fire // Ice',
      layout: 'split',
      card_faces: [
        { name: 'Fire', mana_cost: '{1}{R}', type_line: 'Instant' },
        { name: 'Ice', mana_cost: '{1}{U}', type_line: 'Instant' },
      ],
    }),
  ]);
}

/** Art and set symbol fetchers that never reach the network: every card gets the fallbacks. */
export const offline = { fetchArt: async () => null, fetchSetSymbol: async () => null };
