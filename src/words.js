// Lista de palavras em português + dicionário de emojis + gerador da pilha de palavras.

const WORDS = `
casa gato cachorro janela praia livro escola amigo cidade carro porta mesa cadeira banana
laranja abacaxi morango uva melancia limão tomate batata cenoura alface feijão arroz pão queijo
leite café chocolate bolo pizza sorvete suco água fogo terra vento chuva nuvem estrela lua sol
planeta oceano rio montanha floresta árvore flor folha jardim parque ponte estrada rua avenida
praça mercado farmácia hospital igreja museu teatro cinema música dança festa presente viagem
mala avião navio trem ônibus bicicleta moto caminhão foguete relógio telefone celular
computador teclado mouse tela caneta lápis caderno mochila sapato camisa calça vestido chapéu
óculos anel colar bolsa carteira dinheiro moeda banco trabalho empresa reunião projeto ideia
sonho futuro passado tempo hora minuto segundo semana mês ano domingo segunda verão inverno
outono primavera família pai mãe irmão irmã avó filho filha bebê criança pessoa mulher homem
professor aluno médico policial bombeiro cozinheiro artista cantor pintor escritor futebol bola
gol time jogo vitória derrota campeão medalha corrida natação tênis basquete vôlei xadrez
cartas dado tabuleiro brinquedo boneca pipa balão castelo rei rainha príncipe princesa dragão
fada bruxa mágico tesouro pirata ilha deserto selva caverna vulcão neve gelo calor frio quente
doce salgado amargo azedo feliz triste bravo calmo rápido lento grande pequeno alto baixo forte
fraco novo velho bonito feio limpo sujo cheio vazio claro escuro branco preto vermelho azul
verde amarelo roxo rosa cinza marrom dourado prata cobre leão tigre macaco elefante girafa
zebra cavalo vaca porco galinha pato coelho rato cobra sapo peixe tubarão baleia golfinho polvo
abelha formiga borboleta aranha coruja papagaio pinguim urso lobo raposa tartaruga jacaré
camelo canguru panda abacate ameixa amora caju cereja coco figo goiaba kiwi manga maracujá
mamão pera pêssego tangerina framboesa acerola jabuticaba pitanga caqui brócolis couve repolho
pepino abobrinha berinjela beterraba cebola alho pimentão milho ervilha lentilha mandioca
inhame quiabo chuchu rabanete espinafre carne frango ovo manteiga iogurte farinha açúcar sal
pimenta azeite vinagre macarrão lasanha sopa salada sanduíche torrada biscoito bolacha pudim
brigadeiro pipoca panqueca tapioca cuscuz feijoada churrasco omelete geleia mel canela cravo
xícara copo prato garfo faca colher panela frigideira chaleira bandeja tigela jarra garrafa
forno fogão geladeira pia toalha guardanapo sofá poltrona tapete cortina almofada travesseiro
cobertor lençol colchão cama armário gaveta estante espelho quadro abajur lâmpada ventilador
escada telhado parede chão varanda quintal garagem porão sótão corredor cozinha banheiro quarto
sala chuveiro sabonete xampu escova pente secador tesoura agulha linha botão zíper camiseta
bermuda saia blusa jaqueta casaco suéter meia cueca pijama gravata cinto luva cachecol boné
bota sandália chinelo pulseira brinco cabeça cabelo testa olho nariz boca dente língua orelha
pescoço ombro braço cotovelo mão dedo unha peito barriga costas perna joelho tornozelo coração
pulmão osso sangue pele dentista enfermeiro advogado engenheiro arquiteto programador
jornalista fotógrafo motorista piloto carteiro padeiro açougueiro garçom vendedor cientista
astronauta veterinário fazendeiro pescador carpinteiro eletricista encanador jardineiro
bailarino músico ator atriz palhaço mamãe papai vovó tio tia primo prima neto neta sobrinho
marido esposa noivo noiva vizinho colega burro ovelha cabra galo peru ganso pombo pardal águia
falcão gavião tucano arara andorinha corvo cisne flamingo avestruz hamster esquilo castor coala
preguiça tatu onça leopardo hipopótamo rinoceronte gorila chimpanzé morcego lagarto camaleão
iguana crocodilo sardinha atum salmão camarão lagosta caranguejo lula ostra mexilhão medusa
foca morsa lontra mosquito mosca barata grilo gafanhoto joaninha minhoca lesma caracol vespa
besouro libélula escorpião tulipa girassol margarida orquídea violeta cacto palmeira coqueiro
pinheiro bambu grama musgo semente raiz galho tronco espinho fruta cometa galáxia universo céu
trovão relâmpago neblina geada orvalho granizo tempestade furacão tornado terremoto colina vale
planície lago lagoa riacho cachoeira mar areia onda pedra rocha cristal ouro ferro diamante
bairro vila aldeia capital país estado rodovia calçada esquina semáforo túnel viaduto fonte
estátua monumento palácio torre farol faculdade biblioteca livraria padaria açougue feira loja
shopping restaurante lanchonete cafeteria hotel pousada clínica correio delegacia prefeitura
aeroporto rodoviária estação porto estádio ginásio piscina academia zoológico circo patinete
skate van táxi metrô bonde helicóptero barco canoa jangada submarino trator ambulância tablet
câmera fone microfone impressora controle bateria tomada cabo antena rádio televisão internet
aplicativo senha mensagem vídeo foto filme série borracha régua apostila agenda estojo cola
grampo clipe envelope carta selo cartão bilhete jornal revista dicionário mapa globo raquete
rede apito trave quadra campo pista salto ciclismo surfe judô boxe dama dominó baralho peteca
bolinha carrinho pião ioiô bambolê violão guitarra piano flauta violino sanfona tambor pandeiro
trompete saxofone harpa cavaquinho berimbau amor amizade alegria tristeza saudade medo coragem
raiva calma paz esperança desejo vontade paciência orgulho vergonha ciúme carinho abraço beijo
sorriso lágrima risada manhã tarde noite madrugada hoje ontem amanhã agora sempre nunca cedo
depois antes século década feriado aniversário natal carnaval páscoa férias terça quarta quinta
sexta sábado janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro
dezembro correr andar pular nadar voar cantar dançar pintar desenhar escrever ler estudar
brincar jogar viajar dormir acordar comer beber cozinhar lavar limpar arrumar comprar vender
ganhar perder abrir fechar subir descer entrar sair falar ouvir olhar pensar sorrir chorar
gritar sussurrar esconder procurar encontrar esquecer lembrar ensinar aprender ajudar trabalhar
descansar gordo magro jovem rico pobre macio duro liso áspero leve pesado largo estreito curto
comprido fácil difícil barato caro perto longe prateado bege lilás turquesa caixa pacote sacola
cesta balde vassoura rodo esponja sabão chave cadeado corrente martelo prego parafuso serrote
alicate fita barbante corda tijolo cimento madeira vidro plástico papel papelão metal tecido
couro algodão seda âncora bússola espada escudo coroa trono mago gigante duende sereia
unicórnio fantasma vampiro zumbi monstro robô alienígena herói vilão cavaleiro guerreiro ninja
`.trim().split(/\s+/);

// e = emoji mostrado, a = respostas aceitas
const EMOJIS = [
  { e: '🍎', a: ['maçã'] }, { e: '🍌', a: ['banana'] }, { e: '🍇', a: ['uva', 'uvas'] },
  { e: '🍓', a: ['morango'] }, { e: '🍉', a: ['melancia'] }, { e: '🍍', a: ['abacaxi'] },
  { e: '🍋', a: ['limão'] }, { e: '🍅', a: ['tomate'] }, { e: '🥕', a: ['cenoura'] },
  { e: '🌽', a: ['milho'] }, { e: '🍕', a: ['pizza'] }, { e: '🍔', a: ['hambúrguer', 'hamburguer', 'lanche'] },
  { e: '🍞', a: ['pão'] }, { e: '🧀', a: ['queijo'] }, { e: '🥚', a: ['ovo'] },
  { e: '🍦', a: ['sorvete'] }, { e: '🎂', a: ['bolo'] }, { e: '☕', a: ['café'] },
  { e: '🐶', a: ['cachorro', 'cão', 'cao'] }, { e: '🐱', a: ['gato'] }, { e: '🐭', a: ['rato'] },
  { e: '🐰', a: ['coelho'] }, { e: '🦊', a: ['raposa'] }, { e: '🐻', a: ['urso'] },
  { e: '🐼', a: ['panda'] }, { e: '🦁', a: ['leão'] }, { e: '🐯', a: ['tigre'] },
  { e: '🐮', a: ['vaca'] }, { e: '🐷', a: ['porco'] }, { e: '🐸', a: ['sapo'] },
  { e: '🐵', a: ['macaco'] }, { e: '🐔', a: ['galinha'] }, { e: '🐧', a: ['pinguim'] },
  { e: '🦆', a: ['pato'] }, { e: '🦉', a: ['coruja'] }, { e: '🐴', a: ['cavalo'] },
  { e: '🐝', a: ['abelha'] }, { e: '🦋', a: ['borboleta'] }, { e: '🐢', a: ['tartaruga'] },
  { e: '🐍', a: ['cobra'] }, { e: '🐙', a: ['polvo'] }, { e: '🐟', a: ['peixe'] },
  { e: '🐬', a: ['golfinho'] }, { e: '🐳', a: ['baleia'] }, { e: '🦈', a: ['tubarão'] },
  { e: '🐘', a: ['elefante'] }, { e: '🦒', a: ['girafa'] }, { e: '🦓', a: ['zebra'] },
  { e: '🚗', a: ['carro'] }, { e: '🚌', a: ['ônibus'] }, { e: '🚲', a: ['bicicleta', 'bike'] },
  { e: '✈️', a: ['avião'] }, { e: '🚀', a: ['foguete'] }, { e: '🚂', a: ['trem'] },
  { e: '⚽', a: ['bola', 'futebol'] }, { e: '🏠', a: ['casa'] }, { e: '🌳', a: ['árvore'] },
  { e: '🌸', a: ['flor'] }, { e: '☀️', a: ['sol'] }, { e: '🌙', a: ['lua'] },
  { e: '⭐', a: ['estrela'] }, { e: '☁️', a: ['nuvem'] }, { e: '🌧️', a: ['chuva'] },
  { e: '🔥', a: ['fogo'] }, { e: '❄️', a: ['neve', 'floco'] }, { e: '🌊', a: ['onda', 'mar'] },
  { e: '📚', a: ['livros', 'livro'] }, { e: '✏️', a: ['lápis'] }, { e: '⏰', a: ['relógio', 'despertador'] },
  { e: '📱', a: ['celular', 'telefone'] }, { e: '💻', a: ['computador', 'notebook'] },
  { e: '🎸', a: ['guitarra', 'violão'] }, { e: '🎁', a: ['presente'] }, { e: '🎈', a: ['balão'] },
  { e: '👑', a: ['coroa'] }, { e: '💰', a: ['dinheiro'] }, { e: '🔑', a: ['chave'] },
  { e: '👓', a: ['óculos'] }, { e: '👟', a: ['tênis', 'sapato'] }, { e: '🎩', a: ['chapéu', 'cartola'] },
  { e: '❤️', a: ['coração', 'amor'] }, { e: '🌈', a: ['arco-íris', 'arco íris', 'arcoiris'] },
  { e: '🐉', a: ['dragão'] }, { e: '👻', a: ['fantasma'] }, { e: '🤖', a: ['robô'] },
  { e: '⛄', a: ['boneco de neve'] }, { e: '🍿', a: ['pipoca'] }, { e: '🐞', a: ['joaninha'] },
  // dois emojis = uma palavra composta / expressão
  { e: '🔄 ☀️', a: ['girassol'] },
  { e: '💂 🌧️', a: ['guarda-chuva'] },
  { e: '💂 👕', a: ['guarda-roupa'] },
  { e: '💋 🌸', a: ['beija-flor'] },
  { e: '🐶 🔥', a: ['cachorro-quente'] },
  { e: '⭐ 🌊', a: ['estrela-do-mar'] },
  { e: '🐴 🌊', a: ['cavalo-marinho'] },
  { e: '🍞 🧀', a: ['pão de queijo'] },
  { e: '💧 🥥', a: ['água de coco'] },
  { e: '🦷 🦁', a: ['dente-de-leão'] },
  { e: '🥬 🌸', a: ['couve-flor'] },
  { e: '🌙 🍯', a: ['lua de mel'] },
  { e: '🐝 👑', a: ['abelha rainha'] },
  { e: '🌍 🏍️', a: ['terremoto'] },
  { e: '🕊️ ✉️', a: ['pombo-correio'] },
  { e: '🐟 🐂', a: ['peixe-boi'] },
  { e: '🦈 🔨', a: ['tubarão-martelo'] },
  { e: '🐷 🌵', a: ['porco-espinho'] },
  { e: '✋ 🐮', a: ['mão de vaca'] },
  { e: '😐 🪵', a: ['cara de pau'] },
  { e: '🐟 🗡️', a: ['peixe-espada'] },
  { e: '🦶 🧦', a: ['pé de meia', 'pé-de-meia'] },
  { e: '🎂 🎉', a: ['aniversário', 'festa'] },
  { e: '🏖️ ☀️', a: ['verão', 'praia'] },
  { e: '🍫 🥚', a: ['ovo de páscoa', 'páscoa'] },
  { e: '🎅 🎄', a: ['natal'] },
  { e: '🍕 🔪', a: ['fatia', 'pedaço'] },
];

// Cor da tinta: aparece o NOME de uma cor pintado com OUTRA cor; vale a cor da tinta.
const COLORS = [
  { name: 'vermelho', hex: '#ff4545' },
  { name: 'azul', hex: '#3f86ff' },
  { name: 'verde', hex: '#2fd16f' },
  { name: 'amarelo', hex: '#ffe03a' },
  { name: 'roxo', hex: '#a95cff' },
  { name: 'rosa', hex: '#ff7ec4' },
  { name: 'laranja', hex: '#ff9433' },
  { name: 'branco', hex: '#ffffff' },
];

// Oposto: pares de antônimos (vale nos dois sentidos; algumas palavras aceitam mais de um oposto)
const OPPOSITE_PAIRS = `
quente:frio alto:baixo grande:pequeno dia:noite claro:escuro cheio:vazio rápido:lento
novo:velho feliz:triste forte:fraco limpo:sujo bonito:feio aberto:fechado entrar:sair
subir:descer ganhar:perder comprar:vender começo:fim primeiro:último gordo:magro rico:pobre
caro:barato cedo:tarde perto:longe dentro:fora sim:não bom:mau bom:ruim certo:errado
verdade:mentira amor:ódio guerra:paz vida:morte molhado:seco duro:mole pesado:leve
largo:estreito grosso:fino mais:menos muito:pouco sempre:nunca tudo:nada antes:depois
ontem:amanhã frente:trás esquerda:direita norte:sul leste:oeste branco:preto rir:chorar
dormir:acordar ligar:desligar alegre:triste jovem:velho jovem:idoso homem:mulher menino:menina
rei:rainha verão:inverno acima:abaixo lembrar:esquecer puxar:empurrar doce:amargo doce:salgado
liso:áspero calmo:nervoso feliz:infeliz igual:diferente fácil:difícil curto:comprido
curto:longo raso:fundo raso:profundo bem:mal amigo:inimigo herói:vilão positivo:negativo
aceitar:recusar abrir:fechar acender:apagar chegar:partir encher:esvaziar vencer:perder
ataque:defesa pergunta:resposta vivo:morto ligado:desligado aceso:apagado seguro:perigoso
gentil:grosseiro corajoso:medroso honesto:desonesto possível:impossível legal:ilegal
útil:inútil justo:injusto conhecido:desconhecido sorte:azar luz:escuridão início:fim
entrada:saída ida:volta chegada:partida nascer:morrer dar:receber perguntar:responder
atacar:defender construir:destruir juntar:separar unir:separar somar:subtrair
multiplicar:dividir aumentar:diminuir avançar:recuar amar:odiar sentar:levantar deitar:levantar
cru:cozido maior:menor melhor:pior interno:externo superior:inferior máximo:mínimo
público:privado natural:artificial verdadeiro:falso presente:ausente rápido:devagar
barulho:silêncio barulhento:silencioso doente:saudável sucesso:fracasso subida:descida pai:mãe
avô:avó tio:tia irmão:irmã masculino:feminino príncipe:princesa ator:atriz alguém:ninguém
algo:nada aqui:lá antigo:moderno simples:complicado raro:comum careca:cabeludo
vencedor:perdedor lembrança:esquecimento manhã:noite acordado:dormindo trabalho:descanso
`.trim().split(/\s+/).map((p) => p.split(':'));

const OPPOSITES = (() => {
  const map = new Map();
  for (const [a, b] of OPPOSITE_PAIRS) {
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a).add(b);
    map.get(b).add(a);
  }
  return [...map].map(([word, set]) => ({ word, answers: [...set] }));
})();

function normalize(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Escreve a palavra ao contrário: casa → asac
function reverse(word) {
  return [...word].reverse().join('');
}

// ---------- Número por extenso ----------
const UNITS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

// 0–999 por extenso: 47 → "quarenta e sete", 100 → "cem", 215 → "duzentos e quinze"
function numberToWords(n) {
  if (n < 20) return UNITS[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` e ${UNITS[n % 10]}` : '');
  if (n === 100) return 'cem';
  return HUNDREDS[Math.floor(n / 100)] + (n % 100 ? ` e ${numberToWords(n % 100)}` : '');
}

// Sorteia um número: a maioria pequena, alguns maiores (que dão mais trabalho para escrever)
function randomNumber() {
  const r = Math.random();
  if (r < 0.45) return Math.floor(Math.random() * 31); // 0–30
  if (r < 0.85) return 31 + Math.floor(Math.random() * 70); // 31–100
  return 101 + Math.floor(Math.random() * 899); // 101–999
}

function numberEntry() {
  const n = randomNumber();
  const main = numberToWords(n);
  const answers = [main];
  if (main.includes('catorze')) answers.push(main.replace('catorze', 'quatorze')); // as duas formas valem
  return { type: 'number', display: String(n), answers };
}

// Proporção de cada tipo na pilha
const MIX = [
  ['normal', 0.35],
  ['reversed', 0.13],
  ['emoji', 0.13],
  ['color', 0.13],
  ['opposite', 0.13],
  ['number', 0.13],
];

const MODES = MIX.map(([type]) => type);

// Sorteia um tipo entre os modos ligados (as proporções são reajustadas entre eles)
function pickType(mix) {
  const total = mix.reduce((t, [, w]) => t + w, 0);
  let r = Math.random() * total;
  for (const [type, w] of mix) if ((r -= w) < 0) return type;
  return mix[mix.length - 1][0];
}

// Pool que se reembaralha quando acaba
function pool(items) {
  let left = [];
  return () => {
    if (!left.length) left = shuffle(items);
    return left.pop();
  };
}

function buildStack(n = 120, modes = MODES) {
  const mix = MIX.filter(([type]) => modes.includes(type));
  if (!mix.length) mix.push(...MIX);
  // palíndromos (ovo, osso…) ficam iguais ao contrário, então ficam de fora
  const longWords = WORDS.filter((w) => [...w].length >= 4 && normalize(reverse(w)) !== normalize(w));
  const next = {
    normal: pool(WORDS),
    reversed: pool(longWords),
    emoji: pool(EMOJIS),
    opposite: pool(OPPOSITES),
  };
  const stack = [];
  const recent = []; // evita repetir a mesma resposta em sequência curta
  let lastColor = null;

  while (stack.length < n) {
    const type = pickType(mix);
    let entry;
    if (type === 'emoji') {
      const em = next.emoji();
      entry = { type, display: em.e, answers: em.a };
    } else if (type === 'reversed') {
      const w = next.reversed();
      entry = { type, display: reverse(w), answers: [w] };
    } else if (type === 'opposite') {
      const o = next.opposite();
      entry = { type, display: o.word, answers: o.answers };
    } else if (type === 'number') {
      entry = numberEntry();
    } else if (type === 'color') {
      const inks = COLORS.filter((c) => c.name !== lastColor); // não repete a mesma tinta seguida
      const ink = inks[Math.floor(Math.random() * inks.length)];
      const others = COLORS.filter((c) => c !== ink);
      const word = others[Math.floor(Math.random() * others.length)];
      entry = { type, display: word.name.toUpperCase(), color: ink.hex, answers: [ink.name] };
      lastColor = ink.name;
    } else {
      const w = next.normal();
      entry = { type, display: w, answers: [w] };
    }
    const key = `${type}:${normalize(entry.display)}:${normalize(entry.answers[0])}`;
    if (recent.includes(key)) continue;
    recent.push(key);
    if (recent.length > 15) recent.shift();
    stack.push(entry);
  }
  return stack;
}

// Para comparar respostas: ignora acentos, maiúsculas, espaços e hífens (guarda chuva = guarda-chuva = guardachuva)
function compact(s) {
  return normalize(s).replace(/[^a-z0-9]/g, '');
}

function isCorrect(entry, text) {
  const t = compact(text);
  return t.length > 0 && entry.answers.some((a) => compact(a) === t);
}

export { buildStack, isCorrect, normalize, numberToWords, MODES };
