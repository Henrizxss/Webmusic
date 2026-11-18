# TKGesture

TKGesture é um instrumento musical para navegador que transforma gestos da mão capturados pela webcam em notas e acordes. O reconhecimento é feito com MediaPipe, e o áudio é gerado no navegador pela Web Audio API.

## Recursos

- Modo de acordes com uma mão, sustentando o acorde enquanto o gesto for reconhecido.
- Cada gesto sempre toca as mesmas notas do acorde, com fundamental fixa na nota e oitava escolhidas.
- A troca de acorde exige 12 quadros estáveis para evitar que oscilações breves da câmera mudem o som.
- Teclado virtual e atalhos para testar notas manualmente.
- Timbres selecionáveis, incluindo piano e guitarra.
- Seleção de câmera e, quando compatível com o navegador, da saída de áudio.
- Temas claro e escuro, teclado virtual e guia visual de gestos.

## Gestos

### Acordes

Mantenha a palma voltada para a câmera. Os gestos padrão são:

| Gesto | Acorde inicial |
| --- | --- |
| 1 dedo | C |
| 2 dedos | Dm |
| 3 dedos | Em |
| 4 dedos | F |
| 1 dedo, inclinação à esquerda | G |
| 2 dedos, inclinação à esquerda | Am |
| 3 dedos, inclinação à esquerda | Bdim |

São reconhecidos somente os quatro dedos, sem contar o polegar; abrir a mão inteira também é contado como quatro dedos. A inclinação à esquerda permite três variações adicionais. Na tabela do app, cada gesto pode ser associado a qualquer acorde maior, menor ou diminuto em uma das 12 notas cromáticas. As escolhas são salvas localmente no navegador. Mantenha o gesto para sustentar o acorde; mude a quantidade de dedos ou incline a mão para trocar.

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
- `src/gestureRecognition.ts`: detecção dos quatro dedos e da inclinação usada nos gestos.
- `src/musicTheory.ts`: catálogo cromático de acordes e mapeamentos padrão dos gestos.
- `src/styles.css`: estilos e animações.
- `public/images/tkgesture-chibi.png`: imagem da marca.
