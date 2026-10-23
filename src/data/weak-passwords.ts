/**
 * Common weak passwords and fragments (lowercase ASCII).
 * Matching is substring based on normalized variants, so keep entries at least
 * 4 characters long to avoid false positives inside ordinary words.
 * The target system may use a longer list; extend this one when needed.
 */
export const WEAK_PASSWORDS: readonly string[] = [
  '123456', '1234567', '12345678', '123456789', '1234567890', '1234', '12345', '654321', '111111',
  '000000', '123123', '121212', '112233', '666666', '7777777', '987654', 'qwerty', 'qwertyuiop',
  'qwer', 'asdf', 'asdfgh', 'zxcv', 'zxcvbn', 'abcd', 'abc123', 'qazwsx', '1qaz2wsx', 'zaq12wsx',
  'zaq1@wsx', 'password', 'passw0rd', 'passwd', 'haslo', 'haslo1', 'admin', 'administrator',
  'login', 'welcome', 'letmein', 'iloveyou', 'monkey', 'dragon', 'master', 'shadow', 'sunshine',
  'princess', 'football', 'baseball', 'superman', 'batman', 'trustno1', 'starwars', 'whatever',
  'freedom', 'secret', 'changeme', 'default', 'testtest', 'summer', 'winter', 'spring', 'autumn',
  'polska', 'kochanie', 'kocham', 'misiek', 'skarbie', 'kotek', 'piesek', 'myszka', 'sloneczko',
  'zabka', 'malenstwo', 'niunia', 'kasia', 'marcin', 'mateusz', 'michal', 'agnieszka', 'karolina',
  'magda', 'monika', 'tomek', 'piotr', 'krzysiek', 'lukasz', 'bartek', 'kamil', 'natalia',
  'aleksandra', 'legia', 'lechpoznan', 'barcelona', 'realmadrid', 'liverpool', 'arsenal', 'samsung',
  'google', 'facebook', 'microsoft', 'windows', 'computer', 'internet', 'matrix', 'pokemon',
  'minecraft', 'wiosna', 'jesien', 'zima', 'lato', 'styczen', 'luty', 'marzec', 'kwiecien',
  'czerwiec', 'lipiec', 'sierpien', 'wrzesien', 'pazdziernik', 'listopad', 'grudzien',
  'poniedzialek', 'niedziela',
];
