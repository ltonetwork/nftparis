use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] cosmwasm_std::StdError),

    #[error("Unauthorized error val: {val:?}")]
    Unauthorized { val: String },

    #[error("Custom Error val: {val:?}")]
    CustomError { val: String },

    #[error("Lock error: {val:?}")]
    LockError { val: String },

    #[error("Unknown event type: {val:?}")]
    MatchEventError { val: String },

    #[error("Unknown chain id: {val:?}")]
    MatchChainIdError { val: String },

    #[error("Invalid external event args")]
    InvalidExternalEventArgs {},

    #[error("Method is not implemented for this Ownable")]
    NotImplemented {},
}
