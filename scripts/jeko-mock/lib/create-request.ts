import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { apiError, readBody, sendJson } from './http';
import { fcfa } from './payment-page';
import { SUPPORTED_METHODS, type PaymentRequest } from './types';
import { paymentRequestView } from './view';

type CreateBody = {
  storeId?: string;
  amountCents?: number;
  currency?: string;
  reference?: string;
  paymentDetails?: {
    type?: string;
    data?: {
      paymentMethod?: string;
      successUrl?: string;
      errorUrl?: string;
    };
  };
};

function validate(body: CreateBody) {
  const data = body.paymentDetails?.data;
  const errors: { field: string; rule: string; message: string }[] = [];
  if (!body.storeId)
    errors.push({
      field: 'storeId',
      rule: 'required',
      message: 'storeId requis',
    });
  if (body.currency !== 'XOF')
    errors.push({ field: 'currency', rule: 'enum', message: 'XOF attendu' });
  if (
    !Number.isInteger(body.amountCents) ||
    (body.amountCents as number) < 100 ||
    (body.amountCents as number) % 100 !== 0
  ) {
    errors.push({
      field: 'amountCents',
      rule: 'multipleOf',
      message: 'Multiple de 100, minimum 100',
    });
  }
  const reference = body.reference ?? '';
  if (reference.length < 5 || reference.length > 100) {
    errors.push({
      field: 'reference',
      rule: 'length',
      message: '5 à 100 caractères',
    });
  }
  if (body.paymentDetails?.type !== 'redirect') {
    errors.push({
      field: 'paymentDetails.type',
      rule: 'enum',
      message: 'redirect attendu',
    });
  }
  if (!data?.successUrl || !data.errorUrl) {
    errors.push({
      field: 'paymentDetails.data',
      rule: 'required',
      message: 'successUrl et errorUrl requis',
    });
  }
  return errors;
}

export async function createPaymentRequest(
  req: IncomingMessage,
  res: ServerResponse,
  store: {
    requests: Map<string, PaymentRequest>;
    references: Set<string>;
    baseUrl: string;
  }
) {
  let body: CreateBody;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return apiError(res, 400, 'invalid_body', 'Corps invalide');
  }

  const data = body.paymentDetails?.data;
  const errors = validate(body);
  if (errors.length > 0) {
    return apiError(res, 422, 'validation_error', 'Requête invalide', {
      errors,
    });
  }
  if (!SUPPORTED_METHODS.includes(data?.paymentMethod ?? '')) {
    return apiError(res, 404, 'unsupported_payment_method', 'Méthode inconnue');
  }
  const reference = body.reference ?? '';
  if (store.references.has(reference)) {
    return apiError(
      res,
      409,
      'payment_request_exists_with_reference',
      'Référence déjà utilisée'
    );
  }

  const request: PaymentRequest = {
    id: randomUUID(),
    storeId: body.storeId as string,
    reference,
    amountCents: body.amountCents as number,
    paymentMethod: data!.paymentMethod as string,
    status: 'pending',
    errorReason: null,
    successUrl: data!.successUrl as string,
    errorUrl: data!.errorUrl as string,
    transactionId: null,
    executedAt: null,
  };
  store.requests.set(request.id, request);
  store.references.add(reference);
  console.log(
    `[jeko-mock] demande ${reference} · ${fcfa(request.amountCents)} FCFA · ${request.paymentMethod}`
  );
  sendJson(res, 200, paymentRequestView(request, store.baseUrl));
}
