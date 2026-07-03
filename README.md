# Cordas do Infinito — KORDEX-7 (site oficial)

Site estático oficial do projeto **Cordas do Infinito / KORDEX-7**. Landing page em HTML/CSS puro, com o protótipo jogável **Sintonia Runner** embutido.

## Estrutura

```
index.html            Landing (Home, Sobre, Watchtower, Galeria, Roadmap, Contato)
style.css             Estilos (tema escuro, roxo/ciano, responsivo)
assets/img/           Favicon / ícones
assets/gallery/       Imagens do canon otimizadas para web
game/                 Protótipo Sintonia Runner V3 (Three.js) — botão "Jogar teste"
```

## Rodar localmente

Por causa dos módulos ES do jogo, use um servidor local:

```bash
cd kordex7-site
python -m http.server 4173
# abra http://127.0.0.1:4173/
```

A landing (`index.html`) abre direto no navegador; apenas o jogo em `game/` exige o servidor.

## Publicação

Publicado gratuitamente via **GitHub Pages** a partir da branch `main` (raiz `/`).
O arquivo `.nojekyll` garante que pastas e arquivos sejam servidos sem processamento Jekyll.

## Como atualizar

1. Edite os arquivos (ex.: `index.html`, `style.css`).
2. Faça commit e push para a branch `main`.
3. O GitHub Pages republica automaticamente em ~1 minuto.

## Escopo

Apenas o site. Não altera o jogo Roblox, a Character Factory nem a Tower Factory.
Identidade e canon reutilizados do projeto aprovado.
