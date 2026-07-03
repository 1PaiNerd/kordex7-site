# CORDAS DO INFINITO — SINTONIA RUNNER V3

Runner cósmico procedural 3D/2.5D construído sobre a V2. A V3 preserva a fantasia cósmica cartoon, KORDEX-7, ilhas flutuantes, cristais, portais, HUD, pausa, vitória, áudio procedural, controles mobile e a mecânica central de **Sintonizar Cordas**.

## Como executar

O jogo usa módulos JavaScript e precisa de um servidor local.

### Opção mais simples

Dê dois cliques em:

```text
INICIAR_JOGO.bat
```

O inicializador abre um servidor local em uma porta disponível e inicia o jogo
na URL correta. Não abra `index.html` diretamente pelo Explorador de Arquivos.
O arquivo `INICIAR_JOGO.ps1` é usado internamente pelo inicializador.
Mantenha a janela do servidor aberta enquanto estiver jogando.

```powershell
cd "C:\Users\Ickli\OneDrive\Documentos\Xul\CORDAS_DO_INFINITO_WEB_V3"
python -m http.server 4173
```

Abra:

```text
http://127.0.0.1:4173/index.html
```

Também é possível usar Vite:

```powershell
npm install
npm run dev
```

## Modelo de movimento

A V3 usa o modo **semi-runner**, escolhido por estabilidade:

- a rota sempre cresce para a frente;
- a câmera fica atrás e acima do personagem;
- o level design induz avanço constante;
- WASD, setas e joystick continuam disponíveis;
- não existe câmera livre;
- a arquitetura da câmera permite adicionar rotação leve futuramente.

### Desktop

- `A/D` ou setas laterais: ajuste principal da linha;
- `W/S`: ajuste de profundidade;
- `Espaço`: pular;
- `E`: Sintonizar Cordas;
- `Esc` ou `P`: pausa;
- `R`: reiniciar a fase;
- `M`: ligar/desligar som.

### Mobile

- joystick: movimento;
- botão Pular;
- botão Sintonia;
- botão de pausa no HUD.

## Mecânica de Sintonia

Enquanto a sintonia está ativa:

- pontes fantasma tornam-se sólidas;
- plataformas de fase aparecem;
- cristais ocultos podem ser coletados;
- obstáculos dimensionais ficam desativados;
- a energia é consumida.

Ao desligar, existe uma graça curta antes das pontes perderem solidez. A energia recarrega automaticamente.

## Cinco fases de KORDEX-7

| Fase | Perfil |
|---|---|
| 1 | curta, tutorial, 7 fragmentos |
| 2 | rota maior e gaps ampliados, 8 fragmentos |
| 3 | mais pontes e plataformas fantasma, 9 fragmentos |
| 4 | mais obstáculos e consumo maior, 10 fragmentos |
| 5 | rota final variada e portal especial, 12 fragmentos |

O portal salva o resultado da fase e carrega a próxima seed. Depois da fase 5, o jogo apresenta:

- `MUNDO 00 — KORDEX-7 CONCLUÍDO`;
- `MUNDO 01 — DRAKKARETH EM PREPARAÇÃO`.

## Pontuação e recordes

- `+100` por fragmento;
- bônus por conclusão;
- bônus de tempo;
- `−25` por queda;
- melhor pontuação e melhor tempo gravados em `localStorage`.

O jogo continua funcionando quando o navegador bloqueia armazenamento local.

## Gerador procedural

O contrato público está em `src/levels/generator.js`:

```js
generateProceduralLevel({
  worldId,
  stageNumber,
  seed,
  difficulty,
});
```

O retorno contém:

- `mainPlatforms`;
- `sidePlatforms`;
- `phantomPlatforms`;
- `crystals`;
- `obstacles`;
- `checkpoints`;
- `portalFinal`;
- `spawn`;
- dados compatíveis com `GameWorld`: `islands`, `cords` e `fragments`.

A mesma combinação de mundo, fase, seed e dificuldade produz a mesma rota.

## Como alterar a dificuldade

Use a query string:

```text
http://127.0.0.1:4173/index.html?difficulty=relaxed
http://127.0.0.1:4173/index.html?difficulty=standard
http://127.0.0.1:4173/index.html?difficulty=resonant
```

Para reproduzir uma sequência:

```text
http://127.0.0.1:4173/index.html?seed=KORDEX7
```

Modo de diagnóstico:

```text
http://127.0.0.1:4173/index.html?debug=1&seed=KORDEX7
```

No modo de diagnóstico, a tecla `N` conclui a fase atual para testar rapidamente
as transições e a tela final. Essa tecla não funciona no modo normal.

Os parâmetros por fase ficam em `DEFAULT_STAGE_PROFILES`, dentro de `src/levels/generator.js`. É possível ajustar:

- quantidade de plataformas;
- fragmentos;
- proporção fantasma;
- quantidade de plataformas laterais;
- obstáculos;
- gaps;
- variação lateral e vertical;
- consumo de sintonia.

## Como adicionar outro mundo procedural

1. Criar um perfil como `src/levels/kordex7Runner.js`.
2. Definir cinco ou mais presets de dificuldade.
3. Reutilizar `generateProceduralLevel` ou fornecer profiles próprios.
4. Registrar o mundo em `RunnerProgression`.
5. Criar apenas extensões visuais específicas no `GameWorld`.
6. Reutilizar jogador, input, UI, pontuação, checkpoints e progressão.

Drakkareth permanece registrado como futuro mundo de lava, basalto, cristais vermelhos, pontes instáveis e portais de fogo. Nenhuma regra de Drakkareth foi colocada no core do runner.

## Estrutura principal

```text
src/
  main.js                    fluxo da corrida e troca de fases
  progression.js             seed, fase atual e avanço
  score.js                   pontuação e localStorage
  world.js                   renderização e gameplay do mundo
  player.js                  física, movimento e câmera
  input.js                   teclado, joystick e botões
  ui.js                      HUD, pausa, transição e vitória
  audio.js                   áudio procedural
  levels/
    generator.js             gerador determinístico
    kordex7Runner.js          perfil do Mundo 00
    drakkareth.js             contrato futuro
```

## Critérios mínimos de validação

- botão Iniciar abre a fase 1;
- movimento, pulo e sintonia respondem;
- pontes fantasma mudam de estado;
- fragmentos atualizam HUD e pontuação;
- queda retorna à última âncora;
- portal avança a fase;
- fase 5 encerra KORDEX-7;
- pausa e reinício funcionam;
- controles mobile permanecem visíveis em dispositivo touch;
- console sem erros.
