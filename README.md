# Vida em Equilíbrio

MIGRAÇÃO COMPLETA DO REPOSITÓRIO + EVOLUÇÃO DO GERENCIADOR DE VIDA



Repositório de origem: https://github.com/Dieguinzlk/daily-life-harbor



Objetivo: reproduzir integralmente o aplicativo existente em um novo projeto Lovable, preservando todas as funcionalidades, a identidade visual, as regras de negócio e os dados compatíveis, e implementar as melhorias especificadas abaixo.



1. ANALISE O REPOSITÓRIO ANTES DE IMPLEMENTAR



Acesse e inspecione o repositório GitHub informado. Analise o código-fonte completo, incluindo:



- Todas as pastas e arquivos.

- Todas as rotas e páginas.

- Componentes e layouts.

- Bibliotecas e dependências.

- Integrações de IA e APIs.

- Persistência, armazenamento e banco de dados.

- Autenticação e configurações.

- Gráficos, formulários, navegação e funcionalidades existentes.

- Arquivos de configuração, scripts e variáveis de ambiente necessárias.



Verifique também o histórico e as branches relevantes para identificar implementações importantes que não estejam presentes na versão principal.



Não presuma que funcionalidades estejam implementadas apenas porque existem arquivos relacionados. Verifique o código efetivo e suas dependências.



Se o repositório estiver inacessível, solicite a conexão ou o acesso necessário. Não invente seu conteúdo nem substitua a análise por uma reconstrução baseada somente em descrições.



2. REPRODUZA INTEGRALMENTE O APLICATIVO



Utilize o projeto de origem como referência técnica e funcional.



Reproduza todas as páginas, funcionalidades, componentes, formulários, regras de negócio e integrações que estejam efetivamente implementados.



Preserve:



- A identidade visual e o tema atual.

- A navegação e a estrutura das páginas.

- As funcionalidades de Finanças, Negócio, Rotina, Treinos e Assistente, caso estejam presentes na origem.

- O cadastro e o gerenciamento de transações.

- Os gráficos e indicadores existentes.

- As funcionalidades de backup e restauração.

- A integração de IA e suas ações confirmadas pelo usuário.

- As demais funcionalidades encontradas no código original.



Não crie uma versão demonstrativa, um protótipo simplificado ou apenas uma interface visual.



Não remova recursos existentes para facilitar a implementação. Não substitua funcionalidades reais por dados simulados.



Preserve a arquitetura e as tecnologias existentes sempre que forem compatíveis com o ambiente do novo projeto. Se alguma adaptação for indispensável, explique a necessidade e mantenha o comportamento original.



3. IMPLEMENTE AS NOVAS FUNCIONALIDADES



Após reproduzir a base funcional, implemente as seguintes melhorias.



Dashboard comercial



Substitua o destaque de saldo mensal por indicadores reais de vendas: faturamento diário e mensal, quantidade de vendas, ticket médio, valores a receber e lucro estimado quando houver dados suficientes.



Preserve as informações financeiras existentes nas suas respectivas seções.



Clientes e vendas



Implemente cadastro, pesquisa, edição e arquivamento de clientes.



Integre o cliente ao formulário de vendas usando um seletor pesquisável. Permita cadastrar um novo cliente durante a venda sem perder os dados já preenchidos.



Vincule vendas, produtos, pagamentos e vencimentos ao identificador do cliente.



Consolide o histórico de compras, valores pagos, débitos pendentes, pagamentos parciais e datas. Evite clientes duplicados e registros financeiros repetidos.



Produtos e estoque



Permita adicionar, editar, consultar e arquivar produtos. Mantenha preço, custo, quantidade e estoque mínimo.



Atualize o estoque corretamente após vendas, cancelamentos e devoluções. Preserve o histórico de transações e impeça estoque negativo por padrão.



Gráficos



Corrija e integre os gráficos existentes com dados reais: faturamento por período, produtos mais vendidos, vendas, recebimentos, pendências e lucro estimado quando calculável.



Reutilize as bibliotecas existentes e preserve a compatibilidade com dispositivos móveis.



Login com Google e Supabase



Implemente autenticação real usando Supabase Auth e Google OAuth.



Inclua login, sessão persistente, logout, proteção de rotas, tratamento de erros e nome do usuário autenticado na tela inicial.



Configure a persistência dos dados e o isolamento por usuário com políticas RLS adequadas.



Se o projeto original utilizar localStorage, preserve os dados existentes e planeje uma migração segura, com backup e prevenção de duplicidades.



Não exponha chaves secretas no frontend. Não invente credenciais. Se forem necessárias configurações no Google Cloud ou no Supabase, informe exatamente o que precisa ser configurado.



WhatsApp e lembretes



Integre os lembretes de pagamento às vendas e aos clientes.



Disponibilize a abertura de conversas individuais com mensagens pré-preenchidas. Para envio automático na data de vencimento, utilize a API oficial do WhatsApp Business, agendamento no servidor e credenciais configuradas.



Evite envios duplicados, respeite as regras de mensagens e cancele lembretes futuros quando a dívida for quitada.



Sem configuração da API, mantenha a alternativa manual e identifique claramente a integração automática como pendente.



4. REGRAS DE PRESERVAÇÃO E SEGURANÇA



- Não apagar dados existentes.

- Não remover funcionalidades da origem.

- Não criar módulos duplicados.

- Não modificar recursos fora do escopo sem necessidade comprovada.

- Não executar operações destrutivas no banco de dados.

- Não presumir que variáveis de ambiente, credenciais ou dados serão transferidos automaticamente entre projetos.

- Não considerar uma integração concluída apenas porque seu código foi criado.

- Não publicar alterações no repositório original sem autorização.

- Não contratar serviços pagos nem gerar custos externos sem autorização.



Se houver conflito entre uma implementação antiga e uma melhoria solicitada, preserve as funcionalidades existentes e faça a alteração mínima necessária para atender ao novo requisito.



5. EXECUÇÃO E TESTES



Implemente as mudanças no novo projeto, aproveitando o código original em vez de recriar cada recurso do zero.



Execute os testes disponíveis e valide:



1. Navegação e funcionalidades preexistentes.

2. Cadastro de clientes e vendas vinculadas.

3. Histórico de compras e pagamentos sem duplicidade.

4. Atualização de estoque.

5. Indicadores e gráficos com dados reais.

6. Login Google, sessão e logout.

7. Isolamento dos dados entre usuários.

8. Backup e restauração, quando existentes.

9. Lembretes e comportamento da integração WhatsApp.

10. Compilação e funcionamento em telas móveis.



Corrija os erros introduzidos pelas alterações.



6. RELATÓRIO FINAL



Ao terminar, informe objetivamente:



- Quais partes do repositório foram analisadas.

- Quais funcionalidades originais foram reproduzidas.

- Quais arquivos e módulos foram criados ou modificados.

- Quais melhorias foram implementadas.

- Quais testes foram executados e seus resultados.

- Quais configurações externas ainda são necessárias.

- Quais integrações estão realmente funcionando.

- Quais limitações ou incompatibilidades foram encontradas.



CRITÉRIO FINAL: o novo projeto deve preservar integralmente o comportamento funcional do aplicativo original e incorporar as melhorias solicitadas. Não declare a migração completa enquanto houver funcionalidades originais importantes sem implementação ou validação.



Execute o trabalho no novo projeto Lovable, sem alterar o repositório original. Priorize reutilização de código, mudanças cirúrgicas, integridade dos dados e economia de créditos.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0c5a30c7-f0ef-47d6-a595-b84b5d817823).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
