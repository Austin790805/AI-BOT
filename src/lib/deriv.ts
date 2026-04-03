export class DerivAPI {
  private ws: WebSocket | null = null;
  private appId = 1089;
  private reqId = 1;
  private resolvers: Record<number, { resolve: (value: any) => void; reject: (reason?: any) => void }> = {};

  public onBalanceChange?: (balance: any) => void;
  public onOpenContract?: (contract: any) => void;
  public onTick?: (tick: any) => void;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);
      
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(new Error('WebSocket connection failed'));

      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        
        if (data.req_id && this.resolvers[data.req_id]) {
          if (data.error) {
            this.resolvers[data.req_id].reject(new Error(data.error.message));
          } else {
            this.resolvers[data.req_id].resolve(data);
          }
          if (!data.subscription) {
            delete this.resolvers[data.req_id];
          }
        }

        if (data.msg_type === 'balance' && this.onBalanceChange) {
          this.onBalanceChange(data.balance);
        }
        
        if (data.msg_type === 'proposal_open_contract' && this.onOpenContract) {
          this.onOpenContract(data.proposal_open_contract);
        }

        if (data.msg_type === 'tick' && this.onTick) {
          this.onTick(data.tick);
        }
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async send(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not open'));
      }
      const id = this.reqId++;
      this.resolvers[id] = { resolve, reject };
      this.ws.send(JSON.stringify({ ...request, req_id: id }));
    });
  }

  async authorize(token: string) {
    return this.send({ authorize: token });
  }

  async subscribeBalance() {
    return this.send({ balance: 1, subscribe: 1 });
  }

  async buy(parameters: any, price: number) {
    return this.send({
      buy: 1,
      price: price,
      parameters
    });
  }
  
  async subscribeContract(contractId: number) {
    return this.send({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1
    });
  }

  async subscribeTicks(symbol: string) {
    return this.send({ ticks: symbol, subscribe: 1 });
  }

  async forgetAll(type: string) {
    return this.send({ forget_all: type });
  }
}
