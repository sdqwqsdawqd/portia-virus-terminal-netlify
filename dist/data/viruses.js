// ГЛАВНЫЙ СПИСОК БАЗЫ.
// Чтобы добавить вирус, создайте его файл в папке ./viruses/ по образцу
// virus-template.js, затем добавьте сюда одну строку import и имя в массив.

import { morok } from "./viruses/morok.js";
import { arahna } from "./viruses/arahna.js";
import { kallisto } from "./viruses/kallisto.js";

export const CURRENT_ACCESS_LEVEL = 2;
export const viruses = [morok, arahna, kallisto];
