/** The authenticated trader. Both fields come only from a verified token, never from request input. */
export interface Principal {
  traderId: string;
  brokerId: string;
}
