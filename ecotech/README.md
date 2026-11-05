# EcoTech — Sistema Inteligente de Gestão de Resíduos

Plataforma demonstrativa criada para o Tech & Arte SENAI. O objetivo é conectar pessoas, empresas, escolas e pontos de coleta e orientar o descarte de eletrônicos.

## Executar

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Vite inicia na porta 3000. O usuário demo principal começa em **/login → Acessar demonstração**. Escolha cenários Empresa, Escola, Ponto de coleta ou Administração nos botões dedicados. Para demonstrar validação ambiental, escolha Administração, abra **Agendamentos**, avance o protocolo pelas etapas **Em coleta** e **Concluído**, depois use **Validar descarte**. Saia e entre na demonstração Pessoa para ver os EcoPoints e o impacto contabilizados. O descarte só credita pontos, peso e indicadores depois dessa validação. A agenda salva protocolos e os fluxos usam dados locais fictícios.

## Navegação e arquitetura

O website público usa rotas institucionais `/`, `/sobre`, `/como-funciona`, `/empresas`, `/escolas`, `/impacto`, `/equipe`, `/login` e `/cadastro`. A aplicação autenticada demonstrativa usa `/app`, `/app/pontos-de-coleta`, `/app/pontos-de-coleta/:id`, `/app/agendamentos`, `/app/agendamentos/novo`, `/app/agendamentos/:id`, `/app/recompensas`, `/app/impacto`, `/app/campanhas`, `/app/perfil`, `/app/notificacoes`, `/app/empresa`, `/app/escola` e `/app/admin`.

`src/types.ts` define as entidades; `src/data/seed.ts` disponibiliza dados fictícios; `src/services/store.tsx` administra permissões de interface, persistência local e regras de domínio; `src/components` reúne layouts e componentes acessíveis; `src/pages` separa site institucional, autenticação e plataforma operacional. A persistência demonstrativa é versionada em localStorage/sessionStorage. As oito localizações fictícias são em Palmas/TO. O mapa Leaflet/OpenStreetMap inclui atribuição. Gráficos vêm de registros validados. Exportações são geradas localmente. Os nomes da equipe são exibidos sem cargos ou fotografias inventados.

## Limitações — demonstração, não produção

Não há credenciais Supabase, backend, PostgreSQL, Supabase Auth/Storage, Row Level Security, API real de mapas ou confirmação de parceiros no projeto. A autenticação, os dados pessoais, as permissões e a validação administrativa são **demonstrativos locais e não seguros para dados reais**. Não use senhas, endereços, CNPJ, nomes de estudantes ou informações sensíveis reais. Dados não sincronizam entre dispositivos, perfis ou navegador. Não são enviados e-mails, notificações externas, pedidos reais de coleta, cupons, benefícios ou certificados oficiais. O cenário admin local é demonstração de interface, não controle de acesso confiável. Os oito pontos, materiais, campanhas, recompensas, pesos, EcoPoints e resultados são fictícios. O CO₂e aplica fator pedagógico de 1,5 kg CO₂e por kg de resíduo, sem metodologia científica oficial. Horários e disponibilidade são apenas demonstrativos.

Antes de uso real, será necessário ligar autenticação, regras de acesso, dados e armazenamento a serviços de backend seguros, com políticas de privacidade, consentimento, validação operacional de parceiros, segurança para coleta e critérios ambientais verificados. Nada disso é apresentado como integrado nesta versão.

## Qualidade e build

```sh
pnpm typecheck
pnpm test
pnpm build
```

Inclui 12 testes de regras de negócio e `/manus-routes.json` com o conjunto de rotas efetivas.
