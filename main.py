import numpy as np  # Linear algebra operations
import pandas as pd  # Data processing, CSV file I/O
import os
import warnings


from sklearn.model_selection import GridSearchCV

warnings.filterwarnings('ignore')  # Ignore unnecessary warnings

# Define the dataset path (Modify this according to your local system)
dataset_path = "/Users/arpit/Downloads/Final Year Project"  # Modify path as needed

# List all files in the dataset directory
if os.path.exists(dataset_path):
    print("Files in dataset directory:")
    for dirname, _, filenames in os.walk(dataset_path):
        for filename in filenames:
            print(os.path.join(dirname, filename))
else:
    print(f"Dataset path '{dataset_path}' not found. Please check the path.")

# Define an output directory (Optional)
output_path = "C:/Users/arpit/Desktop/output/"  # Modify path as needed
if not os.path.exists(output_path):
    os.makedirs(output_path)  # Create output directory if it doesn't exist
    print(f"Created output directory: {output_path}")



""" GATHER DATA"""

import pandas as pd  # Data processing and CSV handling
import numpy as np  # Linear algebra operations
import matplotlib.pyplot as plt  # Data visualization
import seaborn as sns  # Advanced data visualization

# Enable interactive mode for displaying plots in PyCharm
plt.ion()

# Alternative to pdpipe: Using sklearn.preprocessing
from sklearn.preprocessing import StandardScaler, MinMaxScaler

print("All libraries imported successfully.")



"""                                                 EXPLORATORY DATA ANALYSIS                                       """

# Set max width of cell
pd.options.display.max_colwidth = 300

# Suppress scientific notation
np.set_printoptions(suppress=True)
pd.options.display.float_format = '{:.2f}'.format

# Display all columns
pd.set_option('display.max_columns', None)

# Read data
df_train = pd.read_csv("/Users/arpit/Downloads/Final Year Project/Train/social_media_train.csv", index_col=[0])

# Display first few rows
print(df_train.head())



"""                                     DATASET DESCRIPTION                                     """

# Read dataset description
data_dict = pd.read_csv("/Users/arpit/Downloads/Final Year Project/Data Description/fake_account__data_dict.csv", index_col="No.")

# Display first few rows
print(data_dict.head())

# Show dataset info
data_dict.info()

"""                                     DATA PREPROCESSING                                      """

# Identify numerical and categorical columns

# Define numerical columns
num_cols = [
    "ratio_numlen_username", "len_fullname", "ratio_numlen_fullname",
    "len_desc", "num_posts", "num_followers", "num_following"
]

# Define categorical columns (all columns except numerical ones)
cat_cols = [col for col in df_train.columns if col not in num_cols]

# Display categorical columns
print("Categorical Columns:", cat_cols)


"""                     BREAK                       """

# Visualize the distribution of the target variable: "fake"
plt.figure(figsize=(10, 5))  # Adjusted figure size for better presentation

# Get value counts for the "fake" column
fake_share = df_train["fake"].value_counts()

# Define labels and colors
labels = ["Not Fake (0)", "Fake (1)"]
colors = ["#99ff99", "#ff9999"]

# Create a pie chart
plt.pie(
    fake_share,
    labels=labels,
    autopct="%1.1f%%",
    colors=colors,
    textprops={"fontsize": 14},  # Slightly reduced font size for better fit
)

plt.title("Target Category Distribution: Fake vs. Not Fake", fontsize=16)
plt.axis("equal")  # Ensures the pie chart is a circle
# plt.show()
plt.show(block=True)




"""                     BREAK                           """

# Check the percentage of the missing values

# Check the percentage of missing values
percent_missing = df_train.isnull().mean() * 100  # More efficient way to calculate %
missing_value_df = pd.DataFrame({'Feature': percent_missing.index, 'Percent Missing (%)': percent_missing.values})

# Sort values in descending order
missing_value_df = missing_value_df.sort_values(by='Percent Missing (%)', ascending=False, ignore_index=True)

# Display the dataframe
print(missing_value_df)

def label_encoding(df):
    '''
    Function label_encoding() transforms categorical features
    represented by strings into numerical values.
    '''
    # Convert 'Yes'/'No' categorical values to binary (0,1)
    dict_label_encoding = {'Yes': 1, 'No': 0}
    df = df.replace(dict_label_encoding)

    # Identify all remaining categorical columns
    cat_cols = df.select_dtypes(include=['object']).columns

    # Apply one-hot encoding to all categorical columns
    df = pd.get_dummies(df, columns=cat_cols, drop_first=True)

    # Convert all columns to numeric
    df = df.apply(pd.to_numeric, errors='coerce')

    # Fill missing values
    df = df.fillna(0)

    return df

df_train = label_encoding(df_train)



"""                     LOGISTIC REGRESSION               """


# Import necessary modules
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import precision_score, recall_score

###################################################################
# a) Without Regularization

# Feature matrix and target vector
features_train = df_train.drop(columns=['fake'])
target_train = df_train['fake']

# Model instantiation (removing unnecessary large C value)
model_log = LogisticRegression(solver='lbfgs', max_iter=10000, C=1e10, random_state=42)

# Model fitting
model_log.fit(features_train, target_train)

#####################################################################
# b) With Regularization

# Standardization to adjust the features
scaler = StandardScaler()
features_train_scaled = scaler.fit_transform(features_train)

# Model instantiation (C=0.5 applies stronger regularization)
model_reg = LogisticRegression(solver='lbfgs', max_iter=10000, C=0.5, random_state=42)

# Model fitting
model_reg.fit(features_train_scaled, target_train)

#####################################################################
# Load and preprocess test data

df_test = pd.read_csv("/Users/arpit/Downloads/Final Year Project/Test/social_media_test.csv", index_col=0)  # Ensure correct file path
df_test = label_encoding(df_test)

# Feature matrix and target vector
features_test = df_test.drop(columns=['fake'])
target_test = df_test['fake']

#####################################################################
# Without Regularization
# Predict target values
target_test_pred_log = model_log.predict(features_test)

# Model evaluation
precision_log = precision_score(target_test, target_test_pred_log)
recall_log = recall_score(target_test, target_test_pred_log)

# Print results
print(f'Precision of model without regularization: {precision_log:.4f}')
print(f'Recall of model without regularization: {recall_log:.4f}')

#####################################################################
# With Regularization
# Scale test features using the previously fitted scaler
features_test_scaled = scaler.transform(features_test)

# Predict target values
target_test_pred_reg = model_reg.predict(features_test_scaled)

# Model evaluation
precision_reg = precision_score(target_test, target_test_pred_reg)
recall_reg = recall_score(target_test, target_test_pred_reg)

# Print results
print(f'Precision of model with regularization: {precision_reg:.4f}')
print(f'Recall of model with regularization: {recall_reg:.4f}')


"""                     RECEIVER OPERATING CHARACTERISTICS                              """

# Import necessary modules
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve


# Function to calculate ROC curve values
def roc_curve_values(model, features, target):
    """
    Computes ROC curve values for a given model.

    Parameters:
        model: Trained classifier model
        features: Feature matrix (DataFrame or array)
        target: True target values

    Returns:
        false_positive_rate, recall, target_test_pred_proba
    """
    # Get predicted probabilities
    target_test_pred_proba = model.predict_proba(features)[:, 1]

    # Compute ROC curve values
    false_positive_rate, recall, _ = roc_curve(target, target_test_pred_proba)

    return false_positive_rate, recall, target_test_pred_proba


# Compute ROC curve values for both models
fpr_log, recall_log, _ = roc_curve_values(model_log, features_test, target_test)
fpr_reg, recall_reg, _ = roc_curve_values(model_reg, features_test, target_test)


# Function to plot ROC curve
def roc_curve_plot(fpr, recall, label):
    """
    Plots the ROC curve.

    Parameters:
        fpr: False Positive Rate values
        recall: Recall (True Positive Rate) values
        label: Model name for legend
    """
    plt.figure(figsize=(8, 6))

    # Reference lines
    plt.plot([0, 1], [0, 1], linestyle="--", label="Random Model", color="blue")  # Diagonal
    plt.axvline(x=0, color='gray', linestyle="--", label="Ideal Model (Vertical)")  # Vertical
    plt.axhline(y=1, color='gray', linestyle="--")  # Horizontal

    # ROC curve
    plt.plot(fpr, recall, label=label, linewidth=2)

    # Labels and title
    plt.title("Receiver Operating Characteristic (ROC) Curve", fontsize=14)
    plt.xlabel("False Positive Rate", fontsize=12)
    plt.ylabel("True Positive Rate (Recall)", fontsize=12)
    plt.legend()
    plt.grid(True)
    plt.show(block=True)


# Plot ROC curves for both models
roc_curve_plot(fpr_log, recall_log, "Logistic Regression (No Regularization)")
roc_curve_plot(fpr_reg, recall_reg, "Logistic Regression (With Regularization)")



"""                     ROC AUC MEASURE                              """

# Import necessary module
from sklearn.metrics import roc_auc_score

target_test_pred_proba_log = model_log.predict_proba(features_test)[:, 1]
target_test_pred_proba_reg = model_reg.predict_proba(features_test_scaled)[:, 1]

# Compute and print ROC AUC scores
roc_auc_log = roc_auc_score(target_test, target_test_pred_proba_log)
roc_auc_reg = roc_auc_score(target_test, target_test_pred_proba_reg)

print(f"ROC AUC Score (Without Regularization): {roc_auc_log:.4f}")
print("#" * 60)
print(f"ROC AUC Score (With Regularization): {roc_auc_reg:.4f}")




"""                     BEST LOGISTIC REGRESSION MODEL WITH GRID SEARCH AND ROC AUC MEASURE                           """
from sklearn.pipeline import Pipeline

# Ensure all features are numerical
features_train = pd.get_dummies(features_train)  # Convert categorical variables if any

# Define pipeline
pipeline_log = Pipeline([
    ('scaler', StandardScaler()),  # Standardization
    ('classifier', LogisticRegression(solver='saga',
                                      max_iter=int(1e4),  # Convert to int for PyCharm compatibility
                                      random_state=42))
])

# Determine search space of hyperparameters
C_values = np.geomspace(start=0.001, stop=1000, num=14)  # Logarithmically spaced C values
search_space_grid = [{'classifier__penalty': ['l1', 'l2'],
                      'classifier__C': C_values}]

# Apply Grid Search
model_grid = GridSearchCV(
    estimator=pipeline_log,
    param_grid=search_space_grid,
    scoring='roc_auc',
    cv=5,
    n_jobs=-1
)

# Debugging: Ensure features are correct before fitting
print(features_train.dtypes)  # Ensure all columns are numeric
print(target_train.unique())  # Check binary values (0,1)

# Model fitting
model_grid.fit(features_train, target_train)

# Print best estimator and score
print("Best Estimator:", model_grid.best_estimator_)
print("Best Parameters:", model_grid.best_params_)
print("Best ROC-AUC Score:", model_grid.best_score_)


"""                     MODEL EVALUATION AND WITH TEST DATA                               """


# Extract the best model from GridSearchCV
best_model = model_grid.best_estimator_

# Apply function roc_curve_values using the best model
false_positive_rate_grid, recall_grid, target_test_pred_proba  = roc_curve_values(best_model, features_test, target_test)

# Plot ROC curve
roc_curve_plot(false_positive_rate_grid, recall_grid, 'model_grid')

# Calculate roc_auc_score


# target_test_pred_proba = best_model.predict_proba(features_test)

# roc_auc = roc_auc_score(target_test, target_test_pred_proba[:, 1])
if len(target_test_pred_proba.shape) == 2:
    roc_auc = roc_auc_score(target_test, target_test_pred_proba[:, 1])
else:
    roc_auc = roc_auc_score(target_test, target_test_pred_proba)  # Use directly if 1D

print("ROC AUC Score after Grid Search (Best Model) on Test data:", roc_auc)




"""                     PREDICTION                      """

# Extract the best model from GridSearchCV
best_model = model_grid.best_estimator_

# Read data
df_aim = pd.read_csv(r"/Users/arpit/Downloads/Final Year Project/Predict/social_media_aim.csv", index_col=[0])

# Apply label encoding (ensure label_encoding function exists)
df_aim = label_encoding(df_aim)

# Feature matrix
features_aim = df_aim.copy()


# Apply Predictions using the best model
df_aim.loc[:, 'fake_pred_proba'] = best_model.predict_proba(features_aim)[:, 1]
df_aim.loc[:, 'fake_pred'] = best_model.predict(features_aim)

# Display first few rows
print(df_aim.head())

import joblib

# Assuming your trained model is named 'model'
joblib.dump(best_model, 'best_model.pkl')
