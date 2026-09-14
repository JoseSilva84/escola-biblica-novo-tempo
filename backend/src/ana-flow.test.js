import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const {
  anaDeliveryQuestion,
  confirmsRegisteredAddress,
  isAffirmativeReply,
  isNegativeReply,
  plausibleNewAddress,
  resolveConversationAiReplySetting
} = await import('./server.js');

test('identifica a pergunta de aceite do brinde', () => {
  assert.equal(
    anaDeliveryQuestion('A partir de 19 de setembro, temos um brinde especial. Você gostaria de receber esse brinde?'),
    'GIFT_ACCEPTANCE'
  );
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
