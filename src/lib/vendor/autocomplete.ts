import autoCompleteLib from '@tarekraafat/autocomplete.js';
import '@tarekraafat/autocomplete.js/dist/css/autoComplete.css';
import { attachGlobals } from '@/lib/attachGlobals';

attachGlobals({ autoComplete: autoCompleteLib });
