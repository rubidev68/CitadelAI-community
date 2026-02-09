/**
 * Weaviate Vector Database API Type Definitions
 */

/**
 * Weaviate where filter operator
 */
export type WeaviateWhereOperator = 'Equal' | 'NotEqual' | 'GreaterThan' | 'GreaterThanEqual' | 'LessThan' | 'LessThanEqual' | 'Like' | 'ContainsAny' | 'ContainsAll' | 'And' | 'Or';

/**
 * Weaviate where filter operand
 */
export interface WeaviateWhereOperand {
  operator: WeaviateWhereOperator;
  path: string[];
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  operands?: WeaviateWhereOperand[];
}

/**
 * Weaviate where filter
 */
export interface WeaviateWhereFilter {
  operator: WeaviateWhereOperator;
  operands?: WeaviateWhereOperand[];
  path?: string[];
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
}

/**
 * Weaviate website content object
 */
export interface WeaviateWebsiteContent {
  url?: string;
  content?: string;
  title?: string;
  chatbotId?: string;
  blockId?: string;
  [key: string]: unknown;
}

/**
 * Weaviate query response
 */
export interface WeaviateQueryResponse<T = WeaviateWebsiteContent> {
  data: {
    Get: {
      [className: string]: T[];
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
  }>;
}

/**
 * Weaviate batch delete response
 */
export interface WeaviateBatchDeleteResponse {
  successful: number;
  failed: number;
  objects?: Array<{
    id: string;
    status: 'SUCCESS' | 'FAILED';
    errors?: {
      error?: Array<{
        message: string;
      }>;
    };
  }>;
}

/**
 * Weaviate error response
 */
export interface WeaviateError {
  error: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
  }>;
}
