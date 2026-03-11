import { Link } from 'react-router-dom';
import { isCreatorContractEnabled } from '../config/contract';

interface CreateQuestProps {
  isConnected: boolean;
}

export function CreateQuest({ isConnected }: CreateQuestProps) {
  const creatorEnabled = isCreatorContractEnabled();

  return (
    <div className="create-quest-card">
      <h3 className="create-quest-title">+ Create Quest</h3>
      <p className="create-quest-sub">
        {creatorEnabled
          ? 'Register a new community quest permanently on Bitcoin L1.'
          : 'On-chain quest creation is coming soon.'}
      </p>

      {creatorEnabled ? (
        <>
          <Link
            to="/create"
            className={`btn btn-primary btn-full${!isConnected ? ' btn-create-disabled' : ''}`}
            onClick={(e) => { if (!isConnected) e.preventDefault(); }}
            aria-disabled={!isConnected}
          >
            Create Quest
          </Link>

          {!isConnected && (
            <p className="form-hint" style={{ marginTop: '0.6rem' }}>
              Connect your OPWallet first.
            </p>
          )}
        </>
      ) : (
        <p className="form-hint" style={{ marginTop: '0.6rem' }}>
          Existing quests and completions are unaffected.
        </p>
      )}
    </div>
  );
}
