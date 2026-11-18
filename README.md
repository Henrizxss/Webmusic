# TKGesture

TKGesture é um instrumento musical para navegador que transforma gestos da mão capturados pela webcam em notas e acordes. O reconhecimento é feito com MediaPipe, e o áudio é gerado no navegador pela Web Audio API.

## Recursos

- Modo de acordes com uma mão, sustentando o acorde enquanto o gesto for reconhecido.
- Teclado virtual e atalhos para testar notas manualmente.
- Timbres selecionáveis, incluindo piano e guitarra.
- Seleção de câmera e, quando compatível com o navegador, da saída de áudio.
- Temas claro e escuro, teclado virtual e guia visual de gestos.

## Gestos

### Acordes

Mantenha a palma voltada para a câmera. Os gestos padrão são:

| Gesto | Inclinação | Acorde inicial |
| --- | --- | --- |
| 1 dedo | Reta ou direita | C |
| 2 dedos | Reta ou direita | Dm |
| 3 dedos | Reta ou direita | Em |
| 4 dedos | Reta ou direita | F |
| 5 dedos (mão aberta) | Reta ou direita | G |
| 2 dedos | Esquerda | Am |
| 3 dedos | Esquerda | Bdim |

O polegar só é contado quando os quatro dedos estão estendidos e a mão está aberta. Na tabela do app, cada gesto pode ser associado a qualquer acorde maior, menor ou diminuto em uma das 12 notas cromáticas. As escolhas são salvas localmente no navegador. Mantenha o gesto para sustentar o acorde; mude os dedos ou a inclinação para trocar.

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
- `src/musicTheory.ts`: catálogo cromático de acordes e mapeamentos padrão dos gestos.
- `src/styles.css`: estilos e animações.
- `public/images/tkgesture-chibi.png`: imagem da marca.
