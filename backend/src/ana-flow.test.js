import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const {
  anaReplyDelayMs,
  buildAnaOperationalReply,
  anaDeliveryFinalReply,
  anaDeliveryQuestion,
  anaGiftOfferReply,
  confirmsRegisteredAddress,
  enforceActiveAnaCampaignDate,
  isAffirmativeReply,
  isAnaClosingAcknowledgement,
  isGiftVisitCancellation,
  isNegativeReply,
  plausibleNewAddress,
  resolveConversationAiReplySetting,
  summarizeAnaDelivery
} = await import('./server.js');

test('calcula uma pausa humana proporcional ao tamanho da resposta', () => {
  const shortDelay = anaReplyDelayMs('Resposta curta.', { body: 'Oi' });
  const longDelay = anaReplyDelayMs('Esta é uma resposta mais longa. '.repeat(20), { body: 'Pode me explicar melhor?' });
  assert.ok(shortDelay >= 4000);
  assert.ok(longDelay > shortDelay);
  assert.ok(longDelay <= 25000);
});

test('identifica a pergunta de aceite do brinde', () => {
  assert.equal(
    anaDeliveryQuestion('A partir de 3 de outubro, temos um brinde especial. Você gostaria de receber esse brinde?'),
    'GIFT_ACCEPTANCE'
  );
});

test('usa somente a data vigente e descreve o brinde como material de estudo', () => {
  const offer = anaGiftOfferReply('Veronica Sabrina');
  const confirmation = anaDeliveryFinalReply('Veronica');
  assert.match(offer, /3 de outubro de 2026/i);
  assert.match(offer, /material de estudo/i);
  assert.match(confirmation, /3 de outubro de 2026/i);
  assert.match(confirmation, /representante/i);
  assert.doesNotMatch(`${offer} ${confirmation}`, /19 de setembro/i);
});

test('bloqueia a data vencida mesmo se o modelo tentar reutilizá-la', () => {
  const corrected = enforceActiveAnaCampaignDate('A partir do dia 19 de setembro de 2026, faremos a entrega.');
  assert.equal(corrected, 'A partir de 3 de outubro de 2026, faremos a entrega.');
});

test('cancelar visita nunca é interpretado como confirmação', () => {
  const message = 'Estou doente e não poderei recepcionar ninguém, pode cancelar a visita';
  assert.equal(isGiftVisitCancellation(message), true);
  assert.equal(isAffirmativeReply(message), false);
});

test('cancelamento posterior retira o lead da entrega aceita mesmo com resposta antiga enviada depois', () => {
  const delivery = summarizeAnaDelivery({
    messages: [
      { direction: 'OUTBOUND', body: anaGiftOfferReply('Veronica') },
      { direction: 'INBOUND', body: 'Sim, quero receber', createdAt: new Date('2026-09-18T12:00:00Z') },
      { direction: 'OUTBOUND', body: anaDeliveryFinalReply('Veronica') },
      { direction: 'INBOUND', body: 'Estou doente, pode cancelar a visita', createdAt: new Date('2026-09-19T12:00:00Z') },
      { direction: 'OUTBOUND', body: 'A partir do dia 19 de setembro de 2026, um representante irá até sua casa para entregar o brinde.' }
    ]
  });
  assert.equal(delivery.accepted, false);
  assert.equal(delivery.cancelled, true);
  assert.equal(delivery.deliveryConfirmed, false);
  assert.equal(delivery.giftDecisionStatus, 'CANCELLED');
});

test('reconhece aceite natural de visita mesmo quando o convite não termina com interrogação', () => {
  const delivery = summarizeAnaDelivery({
    messages: [
      { direction: 'OUTBOUND', body: 'Podemos pedir para um representante da Novo Tempo passar em sua casa e entregar um material de estudo' },
      { direction: 'INBOUND', body: 'Com certeza, será um prazer recebê-los', createdAt: new Date('2026-09-25T18:00:00Z') }
    ]
  });
  assert.equal(delivery.accepted, true);
  assert.equal(delivery.giftDecisionStatus, 'ACCEPTED');
});

test('reconhece confirmação operacional da visita mesmo sem repetir a data da campanha', () => {
  const delivery = summarizeAnaDelivery({
    messages: [
      { direction: 'INBOUND', body: 'Está ótimo', createdAt: new Date('2026-09-25T18:00:00Z') },
      { direction: 'OUTBOUND', body: 'Perfeito. Vou avisar nossa equipe e deixar a visita registrada para a entrega do material.' }
    ]
  });
  assert.equal(delivery.accepted, true);
  assert.equal(delivery.deliveryConfirmed, true);
});

test('não confunde confirmação de recebimento de material com aceite de visita', () => {
  const delivery = summarizeAnaDelivery({
    messages: [
      { direction: 'OUTBOUND', body: 'Você chegou a receber o material?' },
      { direction: 'INBOUND', body: 'Com certeza', createdAt: new Date('2026-09-25T18:00:00Z') }
    ]
  });
  assert.equal(delivery.accepted, false);
  assert.equal(delivery.materialStatus, 'RECEIVED');
});

test('distingue confirmação de endereço de pedido de endereço novo', () => {
  assert.equal(
    anaDeliveryQuestion('O endereço para a entrega é o mesmo que está cadastrado na Novo Tempo ou você deseja informar outro?'),
    'ADDRESS_CONFIRMATION'
  );
  assert.equal(
    anaDeliveryQuestion('Pode enviar seu endereço completo atual?'),
    'ADDRESS_REQUEST'
  );
});

test('interpreta respostas curtas à confirmação do endereço', () => {
  assert.equal(confirmsRegisteredAddress('É o mesmo'), true);
  assert.equal(confirmsRegisteredAddress('o mesmo'), true);
  assert.equal(confirmsRegisteredAddress('não, mudou'), false);
  assert.equal(isAffirmativeReply('sim'), true);
  assert.equal(isNegativeReply('não, é outro'), true);
});

test('aceita endereço informado e não confunde confirmação com endereço', () => {
  assert.equal(plausibleNewAddress('Rua das Flores, 123, Centro, São Paulo - SP'), 'Rua das Flores, 123, Centro, São Paulo - SP');
  assert.equal(plausibleNewAddress('é o mesmo'), '');
});

test('prioriza o modo persistente da conversa sem apagar o controle histórico', () => {
  const messages = [{ metadata: { aiReplyEnabled: true } }];
  assert.equal(resolveConversationAiReplySetting({ aiReplyEnabled: false, messages }), false);
  assert.equal(resolveConversationAiReplySetting({ aiReplyEnabled: null, messages }), true);
  assert.equal(resolveConversationAiReplySetting({ messages: [] }), null);
});

test('não reinicia a pergunta sobre o material depois que a entrega já foi confirmada', async () => {
  const inboundMessage = {
    id: 'inbound-amen',
    direction: 'INBOUND',
    body: 'Amém',
    createdAt: new Date('2026-09-26T09:58:18Z')
  };
  const conversation = {
    leadName: 'Antônio Carlos bispo perassim',
    messages: [
      {
        id: 'outbound-material',
        direction: 'OUTBOUND',
        body: 'Você chegou a receber o material da Escola Bíblica Novo Tempo?',
        createdAt: new Date('2026-09-25T22:29:40Z')
      },
      {
        id: 'inbound-not-received',
        direction: 'INBOUND',
        body: 'Não chegou',
        createdAt: new Date('2026-09-25T22:30:00Z')
      },
      {
        id: 'outbound-gift',
        direction: 'OUTBOUND',
        body: 'A partir de 3 de outubro de 2026, um representante poderá entregar um brinde especial, um material de estudo. Você gostaria de recebê-lo?',
        createdAt: new Date('2026-09-26T09:56:45Z')
      },
      {
        id: 'inbound-yes',
        direction: 'INBOUND',
        body: 'Sim',
        createdAt: new Date('2026-09-26T09:57:05Z')
      },
      {
        id: 'outbound-address',
        direction: 'OUTBOUND',
        body: 'O endereço para a entrega é o mesmo que está cadastrado na Novo Tempo ou você deseja informar outro?',
        createdAt: new Date('2026-09-26T09:57:16Z')
      },
      {
        id: 'inbound-same-address',
        direction: 'INBOUND',
        body: 'É o mesmo',
        createdAt: new Date('2026-09-26T09:57:46Z')
      },
      {
        id: 'outbound-confirmation',
        direction: 'OUTBOUND',
        body: anaDeliveryFinalReply('Antônio'),
        createdAt: new Date('2026-09-26T09:58:00Z')
      },
      inboundMessage
    ]
  };

  assert.equal(isAnaClosingAcknowledgement('Amém'), true);
  const reply = await buildAnaOperationalReply({ conversation, inboundMessage });
  assert.equal(reply.reason, 'delivery-completed-acknowledgement');
  assert.match(reply.message, /^Amém, Antônio!/i);
  assert.doesNotMatch(reply.message, /chegou a receber|receber o material/i);
  assert.doesNotMatch(reply.message, /\?/);
});
