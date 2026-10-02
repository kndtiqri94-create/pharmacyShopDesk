import { HttpResponseInit } from '@azure/functions';
import { ApiResponse } from '../models/common/api-response.model';

export class HttpResponseHelper {
  /**
   * Creates a successful HTTP response with data
   */
  static success<T>(data: T, message?: string, status: number = 200): HttpResponseInit {
    return {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApiResponse.success(data, message))
    };
  }

  /**
   * Creates a successful HTTP response for created resources
   */
  static created<T>(data: T, message?: string): HttpResponseInit {
    return this.success(data, message, 201);
  }

  /**
   * Creates a successful HTTP response with no content
   */
  static noContent(message?: string): HttpResponseInit {
    return {
      status: 204,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApiResponse.success(null, message))
    };
  }

  /**
   * Creates a bad request error response
   */
  static badRequest(message: string, errors?: string[]): HttpResponseInit {
    return {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApiResponse.error(message, errors))
    };
  }

  /**
   * Creates an unauthorized error response
   */
  static unauthorized(message: string = 'Unauthorized'): HttpResponseInit {
    return {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApiResponse.error(message))
    };
  }

  /**
   * Creates a forbidden error response
   */
  static forbidden(message: string = 'Forbidden'): HttpResponseInit {
    return {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApiResponse.error(message))
    };
  }

  /**
   * Creates a not found error response
   */
  static notFound(message: string = 'Resource not found'): HttpResponseInit {
    return {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApiResponse.error(message))
    };
  }

  /**
   * Creates a conflict error response
   */
  static conflict(message: string): HttpResponseInit {
    return {
      status: 409,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApiResponse.error(message))
    };
  }

  /**
   * Creates a validation error response
   */
  static validationError(message: string = 'Validation failed', errors?: string[]): HttpResponseInit {
    return this.badRequest(message, errors);
  }

  /**
   * Creates an internal server error response
   */
  static internalServerError(message: string = 'Internal server error'): HttpResponseInit {
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApiResponse.error(message))
    };
  }

  /**
   * Creates a custom error response
   */
  static error(status: number, message: string, errors?: string[]): HttpResponseInit {
    return {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApiResponse.error(message, errors))
    };
  }

  /**
   * Creates a response for when a resource is not found or cannot be deleted
   */
  static notFoundOrCannotDelete(resourceName: string): HttpResponseInit {
    return this.notFound(`${resourceName} not found or could not be deleted`);
  }

  /**
   * Creates a response for missing required parameters
   */
  static missingParameter(parameterName: string): HttpResponseInit {
    return this.badRequest(`${parameterName} is required`);
  }

  /**
   * Creates a response for invalid parameter values
   */
  static invalidParameter(parameterName: string, expectedType?: string): HttpResponseInit {
    const message = expectedType 
      ? `Invalid ${parameterName}. Expected ${expectedType}`
      : `Invalid ${parameterName}`;
    return this.badRequest(message);
  }
}
