# TKGesture

TKGesture é um instrumento musical para navegador que transforma gestos da mão capturados pela webcam em notas e acordes. O reconhecimento é feito com MediaPipe, e o áudio é gerado no navegador pela Web Audio API.

## Recursos

- Modo de notas com seleção pela posição do indicador e sustentação enquanto a pinça entre polegar e indicador é mantida.
- Modo de acordes com uma mão, sustentando o acorde enquanto o gesto for reconhecido.
- Timbres selecionáveis, incluindo piano e guitarra.
- Seleção de câmera e, quando compatível com o navegador, da saída de áudio.
- Temas claro e escuro, teclado virtual e guia visual de gestos.

## Gestos

### Acordes

Mantenha a palma voltada para a câmera. A mão reta ou inclinada para a direita usa o conjunto principal; incline-a para a esquerda para acessar o conjunto alternativo.

| Acorde | Dedos | Inclinação |
| --- | ---: | --- |
| C | 2 | Reta ou direita |
| Dm | 3 | Reta ou direita |
| Em | 4 | Reta ou direita |
| F | 5 | Reta ou direita |
| Am | 2 | Esquerda |
| G | 3 | Esquerda |
| Bdim | 4 | Esquerda |

Mantenha o gesto para sustentar o acorde; mude os dedos ou a inclinação para trocar.

### Notas

Mova o indicador horizontalmente para escolher uma das notas naturais. Faça uma pinça com o polegar e o indicador para tocar e mantenha-a para sustentar a nota; solte para interromper o som.

## Executar localmente

Requisitos: Node.js 20 LTS ou superior e npm.

```bash
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`.

Para validar a versão de produção localmente:

```bash
npm run build
npm run preview
```

Os arquivos de produção são gerados em `dist/`.

## Publicar na Vercel

Importe o repositório na Vercel e use o preset **Vite**. As configurações são:

- Comando de build: `npm run build`
- Diretório de saída: `dist`
- Comando de instalação: `npm install`

A aplicação precisa de permissão para usar a câmera. Em produção, acesse pelo domínio HTTPS da Vercel. A escolha de saída de áudio depende do suporte do navegador.

## Tecnologias

- React e TypeScript
- Vite
- MediaPipe Tasks Vision — Hand Landmarker
- Web Audio API
- Canvas API

O TKGesture é executado no navegador e não requer banco de dados ou servidor de aplicação.

## Estrutura principal

- `src/App.tsx`: interface, controles de áudio e modos musicais.
- `src/useHandTracking.ts`: acesso à câmera, rastreamento e resposta aos gestos.
- `src/gestureRecognition.ts`: detecção de dedos, inclinação da mão e pinça.
- `src/musicTheory.ts`: acordes do campo harmônico e notas MIDI.
- `src/styles.css`: estilos e animações.
- `public/images/tkgesture-chibi.png`: imagem da marca.
