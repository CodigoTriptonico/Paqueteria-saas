export const SCGS_ORG_ID = "2029bf0c-e766-4840-9d90-f4b252cc3fe9";

export const COUNTRIES = [
  { code: "MX", name: "México", deliveryTime: "3-5 dias" },
  { code: "CO", name: "Colombia", deliveryTime: "7-10 dias" },
  { code: "GT", name: "Guatemala", deliveryTime: "5-8 dias" },
  { code: "SV", name: "El Salvador", deliveryTime: "5-8 dias" },
  { code: "HN", name: "Honduras", deliveryTime: "5-8 dias" },
  { code: "NI", name: "Nicaragua", deliveryTime: "6-9 dias" },
];

export const RECIPIENTS_BY_COUNTRY = {
  "México": [
    { first_name: "Rosa", last_name: "García", phone: "+52-33-3612-8840", street: "Av. Chapultepec", house_number: "245", neighborhood: "Americana", city: "Guadalajara", state: "Jalisco", postal_code: "44160" },
    { first_name: "Elena", last_name: "Vargas", phone: "+52-81-8345-2291", street: "Av. Constitución", house_number: "1520", neighborhood: "Centro", city: "Monterrey", state: "Nuevo León", postal_code: "64000" },
    { first_name: "Pedro", last_name: "Jiménez", phone: "+52-55-5512-4478", street: "Insurgentes Sur", house_number: "892", neighborhood: "Del Valle", city: "Ciudad de México", state: "CDMX", postal_code: "03100" },
    { first_name: "Laura", last_name: "Morales", phone: "+52-222-312-5567", street: "Blvd. 5 de Mayo", house_number: "318", neighborhood: "La Paz", city: "Puebla", state: "Puebla", postal_code: "72160" },
    { first_name: "Ricardo", last_name: "Navarro", phone: "+52-477-712-9034", street: "Blvd. López Mateos", house_number: "2104", neighborhood: "Jardines del Moral", city: "León", state: "Guanajuato", postal_code: "37160" },
    { first_name: "Carmen", last_name: "Ortega", phone: "+52-664-382-1145", street: "Av. Revolución", house_number: "1450", neighborhood: "Zona Centro", city: "Tijuana", state: "Baja California", postal_code: "22000" },
    { first_name: "Alberto", last_name: "Ríos", phone: "+52-449-912-3380", street: "Av. Universidad", house_number: "702", neighborhood: "Barrio de la Estación", city: "Aguascalientes", state: "Aguascalientes", postal_code: "20130" },
    { first_name: "Verónica", last_name: "Salazar", phone: "+52-998-884-5521", street: "Av. Tulum", house_number: "88", neighborhood: "Supermanzana 62", city: "Cancún", state: "Quintana Roo", postal_code: "77525" },
    { first_name: "Héctor", last_name: "Mendoza", phone: "+52-442-215-6678", street: "Av. Corregidora Norte", house_number: "456", neighborhood: "Centro Histórico", city: "Querétaro", state: "Querétaro", postal_code: "76000" },
    { first_name: "Isabel", last_name: "Torres", phone: "+52-614-415-8890", street: "Av. Teófilo Borunda", house_number: "11230", neighborhood: "San Felipe", city: "Chihuahua", state: "Chihuahua", postal_code: "31203" },
  ],
  Colombia: [
    { first_name: "Andrés", last_name: "Mejía", phone: "+57-601-234-5678", street: "Carrera 7", house_number: "45-12", neighborhood: "Chapinero", city: "Bogotá", state: "Cundinamarca", postal_code: "110221" },
    { first_name: "Camila", last_name: "Restrepo", phone: "+57-604-312-8890", street: "Calle 10", house_number: "43-21", neighborhood: "El Poblado", city: "Medellín", state: "Antioquia", postal_code: "050021" },
    { first_name: "Diego", last_name: "Villalobos", phone: "+57-602-445-6677", street: "Av. 6N", house_number: "28-15", neighborhood: "Granada", city: "Cali", state: "Valle del Cauca", postal_code: "760044" },
    { first_name: "Mariana", last_name: "Quintero", phone: "+57-605-778-3344", street: "Calle 84", house_number: "51-40", neighborhood: "El Prado", city: "Barranquilla", state: "Atlántico", postal_code: "080001" },
    { first_name: "Felipe", last_name: "Cardona", phone: "+57-607-901-2233", street: "Carrera 14", house_number: "9-67", neighborhood: "Cabecera", city: "Bucaramanga", state: "Santander", postal_code: "680003" },
    { first_name: "Valentina", last_name: "Osorio", phone: "+57-608-556-7788", street: "Calle 32", house_number: "12-08", neighborhood: "Centro", city: "Pereira", state: "Risaralda", postal_code: "660001" },
    { first_name: "Santiago", last_name: "Rendón", phone: "+57-601-889-4411", street: "Av. Suba", house_number: "127-45", neighborhood: "Suba", city: "Bogotá", state: "Cundinamarca", postal_code: "111121" },
    { first_name: "Daniela", last_name: "Muñoz", phone: "+57-604-223-9900", street: "Calle 50", house_number: "67-22", neighborhood: "Laureles", city: "Medellín", state: "Antioquia", postal_code: "050034" },
    { first_name: "Julián", last_name: "Patiño", phone: "+57-602-667-1122", street: "Carrera 1", house_number: "5-90", neighborhood: "San Antonio", city: "Cali", state: "Valle del Cauca", postal_code: "760001" },
    { first_name: "Natalia", last_name: "Giraldo", phone: "+57-605-334-5566", street: "Calle 72", house_number: "34-18", neighborhood: "Riomar", city: "Barranquilla", state: "Atlántico", postal_code: "080020" },
  ],
  Guatemala: [
    { first_name: "Luis", last_name: "Morales", phone: "+502-2234-5566", street: "Av. Reforma", house_number: "12-45", neighborhood: "Zona 10", city: "Ciudad de Guatemala", state: "Guatemala", postal_code: "01010" },
    { first_name: "Sofía", last_name: "Recinos", phone: "+502-7765-4433", street: "Calle del Arco", house_number: "5A", neighborhood: "Centro Histórico", city: "Antigua Guatemala", state: "Sacatepéquez", postal_code: "03001" },
    { first_name: "Marco", last_name: "Estrada", phone: "+502-2411-8899", street: "Blvd. Los Próceres", house_number: "18-22", neighborhood: "Zona 11", city: "Ciudad de Guatemala", state: "Guatemala", postal_code: "01011" },
    { first_name: "Paola", last_name: "Ixquiac", phone: "+502-7761-2200", street: "7a Calle Poniente", house_number: "15", neighborhood: "Centro", city: "Quetzaltenango", state: "Quetzaltenango", postal_code: "09001" },
    { first_name: "Rafael", last_name: "Barrios", phone: "+502-2257-3344", street: "Calzada Roosevelt", house_number: "33-10", neighborhood: "Zona 7", city: "Ciudad de Guatemala", state: "Guatemala", postal_code: "01007" },
    { first_name: "Gabriela", last_name: "Sis", phone: "+502-7948-1122", street: "4a Avenida Sur", house_number: "8", neighborhood: "Centro", city: "Escuintla", state: "Escuintla", postal_code: "05001" },
    { first_name: "Otto", last_name: "Pérez", phone: "+502-7763-9900", street: "12 Avenida A", house_number: "2-14", neighborhood: "Zona 1", city: "Quetzaltenango", state: "Quetzaltenango", postal_code: "09001" },
    { first_name: "Claudia", last_name: "Méndez", phone: "+502-2285-6677", street: "Av. Hincapié", house_number: "7-55", neighborhood: "Zona 13", city: "Ciudad de Guatemala", state: "Guatemala", postal_code: "01013" },
    { first_name: "Héctor", last_name: "López", phone: "+502-7765-7788", street: "3a Calle Oriente", house_number: "21", neighborhood: "Centro", city: "Antigua Guatemala", state: "Sacatepéquez", postal_code: "03001" },
    { first_name: "Karla", last_name: "Samayoa", phone: "+502-2420-4455", street: "Diagonal 6", house_number: "10-80", neighborhood: "Zona 10", city: "Ciudad de Guatemala", state: "Guatemala", postal_code: "01010" },
  ],
  "El Salvador": [
    { first_name: "Roberto", last_name: "Funes", phone: "+503-2234-5566", street: "Blvd. Los Héroes", house_number: "2345", neighborhood: "San Benito", city: "San Salvador", state: "San Salvador", postal_code: "1101" },
    { first_name: "Marta", last_name: "Henríquez", phone: "+503-2445-7788", street: "Calle Arce", house_number: "1234", neighborhood: "Colonia Escalón", city: "San Salvador", state: "San Salvador", postal_code: "1101" },
    { first_name: "Eduardo", last_name: "Cáceres", phone: "+503-2567-3344", street: "Av. Masferrer Norte", house_number: "567", neighborhood: "Colonia Escalón", city: "San Salvador", state: "San Salvador", postal_code: "1101" },
    { first_name: "Silvia", last_name: "Romero", phone: "+503-2442-9900", street: "Calle Libertad", house_number: "45", neighborhood: "Centro", city: "Santa Ana", state: "Santa Ana", postal_code: "2201" },
    { first_name: "José", last_name: "Portillo", phone: "+503-2620-1122", street: "Calle Principal", house_number: "12", neighborhood: "Centro", city: "San Miguel", state: "San Miguel", postal_code: "3301" },
    { first_name: "Rosa", last_name: "Guevara", phone: "+503-2235-6677", street: "Paseo General Escalón", house_number: "3890", neighborhood: "Escalón", city: "San Salvador", state: "San Salvador", postal_code: "1101" },
    { first_name: "Manuel", last_name: "Sorto", phone: "+503-2443-4455", street: "2a Calle Poniente", house_number: "8", neighborhood: "Centro", city: "Santa Ana", state: "Santa Ana", postal_code: "2201" },
    { first_name: "Lorena", last_name: "Zelaya", phone: "+503-2501-8899", street: "Calle Roosevelt", house_number: "210", neighborhood: "Centro", city: "San Miguel", state: "San Miguel", postal_code: "3301" },
    { first_name: "Francisco", last_name: "Molina", phone: "+503-2260-2233", street: "Calle Sisimiles", house_number: "67", neighborhood: "Mejicanos", city: "San Salvador", state: "San Salvador", postal_code: "1120" },
    { first_name: "Beatriz", last_name: "Aguilar", phone: "+503-2441-5566", street: "Av. Independencia", house_number: "102", neighborhood: "Centro", city: "Santa Ana", state: "Santa Ana", postal_code: "2201" },
  ],
  Honduras: [
    { first_name: "Carlos", last_name: "Zelaya", phone: "+504-2234-5566", street: "Blvd. Morazán", house_number: "3456", neighborhood: "Palmira", city: "Tegucigalpa", state: "Francisco Morazán", postal_code: "11101" },
    { first_name: "Diana", last_name: "Matute", phone: "+504-2556-7788", street: "Av. Circunvalación", house_number: "890", neighborhood: "Los Próceres", city: "San Pedro Sula", state: "Cortés", postal_code: "21102" },
    { first_name: "Mario", last_name: "Figueroa", phone: "+504-2237-3344", street: "Calle República de Chile", house_number: "1203", neighborhood: "Colonia Palmira", city: "Tegucigalpa", state: "Francisco Morazán", postal_code: "11101" },
    { first_name: "Gloria", last_name: "Mejía", phone: "+504-2558-9900", street: "Blvd. del Norte", house_number: "4567", neighborhood: "Colonia Trejo", city: "San Pedro Sula", state: "Cortés", postal_code: "21101" },
    { first_name: "René", last_name: "Padilla", phone: "+504-2782-1122", street: "Av. Central", house_number: "45", neighborhood: "Centro", city: "La Ceiba", state: "Atlántida", postal_code: "31101" },
    { first_name: "Ingrid", last_name: "Bonilla", phone: "+504-2232-6677", street: "Col. Lomas del Guijarro", house_number: "Lote 12", neighborhood: "Lomas del Guijarro", city: "Tegucigalpa", state: "Francisco Morazán", postal_code: "11101" },
    { first_name: "Wilmer", last_name: "Cruz", phone: "+504-2552-4455", street: "Calle 9", house_number: "3-45", neighborhood: "Barrio Guamilito", city: "San Pedro Sula", state: "Cortés", postal_code: "21101" },
    { first_name: "Yolanda", last_name: "Rivas", phone: "+504-2783-8899", street: "Barrio El Centro", house_number: "78", neighborhood: "Centro", city: "La Ceiba", state: "Atlántida", postal_code: "31101" },
    { first_name: "Oscar", last_name: "Amador", phone: "+504-2238-2233", street: "Col. Miraflores", house_number: "234", neighborhood: "Miraflores", city: "Tegucigalpa", state: "Francisco Morazán", postal_code: "11101" },
    { first_name: "Karen", last_name: "Sosa", phone: "+504-2559-5566", street: "Res. El Prado", house_number: "15", neighborhood: "El Prado", city: "San Pedro Sula", state: "Cortés", postal_code: "21102" },
  ],
  Nicaragua: [
    { first_name: "Javier", last_name: "Bermúdez", phone: "+505-2222-3344", street: "Carretera Masaya", house_number: "Km 4.5", neighborhood: "Las Colinas", city: "Managua", state: "Managua", postal_code: "14000" },
    { first_name: "Lucía", last_name: "Corea", phone: "+505-2311-5566", street: "Calle Central", house_number: "45", neighborhood: "Centro", city: "León", state: "León", postal_code: "21000" },
    { first_name: "Pedro", last_name: "Zeledón", phone: "+505-2266-7788", street: "Pista Juan Pablo II", house_number: "1234", neighborhood: "Los Robles", city: "Managua", state: "Managua", postal_code: "14000" },
    { first_name: "Adriana", last_name: "Téllez", phone: "+505-2552-9900", street: "Av. Central", house_number: "12", neighborhood: "Centro", city: "Granada", state: "Granada", postal_code: "43000" },
    { first_name: "Ramón", last_name: "Obando", phone: "+505-2782-1122", street: "Barrio El Calvario", house_number: "8", neighborhood: "Centro", city: "Chinandega", state: "Chinandega", postal_code: "25000" },
    { first_name: "Estela", last_name: "Jarquín", phone: "+505-2223-6677", street: "Col. Los Ángeles", house_number: "56", neighborhood: "Los Ángeles", city: "Managua", state: "Managua", postal_code: "14000" },
    { first_name: "Víctor", last_name: "Urbina", phone: "+505-2312-4455", street: "Calle Real", house_number: "90", neighborhood: "Centro", city: "León", state: "León", postal_code: "21000" },
    { first_name: "Marisol", last_name: "Blandón", phone: "+505-2553-8899", street: "Calle La Calzada", house_number: "22", neighborhood: "Centro", city: "Granada", state: "Granada", postal_code: "43000" },
    { first_name: "Ernesto", last_name: "Gutiérrez", phone: "+505-2783-2233", street: "Barrio San José", house_number: "34", neighborhood: "Centro", city: "Chinandega", state: "Chinandega", postal_code: "25000" },
    { first_name: "Rebeca", last_name: "Montenegro", phone: "+505-2224-5566", street: "Res. Bolonia", house_number: "78", neighborhood: "Bolonia", city: "Managua", state: "Managua", postal_code: "14000" },
  ],
};

export function normalizeCountryName(country) {
  return country
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function isSameCountry(left, right) {
  return normalizeCountryName(left) === normalizeCountryName(right);
}

export function shuffle(items, random = Math.random) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

export function pickRandomRecipientCountries(random = Math.random) {
  const minCountries = 2;
  const maxCountries = COUNTRIES.length;
  const count = minCountries + Math.floor(random() * (maxCountries - minCountries + 1));
  return shuffle(COUNTRIES, random).slice(0, count);
}

export function pickRecipientTemplate(countryName, random = Math.random) {
  const templates = RECIPIENTS_BY_COUNTRY[countryName] || [];
  if (!templates.length) {
    return null;
  }

  return templates[Math.floor(random() * templates.length)];
}

export function recipientForSenderIndexed(sender, countryName, senderIndex, countryIndex) {
  const templates = RECIPIENTS_BY_COUNTRY[countryName] || [];
  const template = templates[(senderIndex + countryIndex) % templates.length];

  return {
    ...template,
    last_name: sender.last_name || template.last_name,
  };
}

export function recipientForSenderRandom(sender, countryName, random = Math.random) {
  const template = pickRecipientTemplate(countryName, random);
  if (!template) {
    return null;
  }

  return {
    ...template,
    last_name: sender.last_name || template.last_name,
  };
}
