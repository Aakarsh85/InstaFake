import numpy as np  # For numerical operations, e.g., arrays, math
import pandas as pd  # For handling dataframes (loading, manipulating CSVs)
import os  # For working with directories and paths
import warnings  # To handle or suppress warnings

from sklearn.model_selection import GridSearchCV  # For hyperparameter tuning via cross-validation
warnings.filterwarnings('ignore')  # Ignore all warnings to keep output clean

# Dataset path
dataset_path = "'/Users/arpit/Downloads/Final Year Project'"  # You should update this path to where your data is stored

# Check if dataset path exists and list all files in that directory
if os.path.exists(dataset_path):
    print("Files in dataset directory:")
    for dirname, _, filenames in os.walk(dataset_path):
        for filename in filenames:
            print(os.path.join(dirname, filename))
else:
    print(f"Dataset path '{dataset_path}' not found. Please check the path.")

# Output path
output_path = "C:/Users/arpit/Desktop/output/"
if not os.path.exists(output_path):
    os.makedirs(output_path)
    print(f"Created output directory: {output_path}")

# Additional imports for data analysis
import matplotlib.pyplot as plt  # For plotting data
import seaborn as sns  # For statistical data visualization
from sklearn.preprocessing import StandardScaler, MinMaxScaler  # For feature scaling

plt.ion()  # Enables interactive plotting in some environments

print("All libraries imported successfully.")

# Exploratory Data Analysis settings
pd.options.display.max_colwidth = 300
np.set_printoptions(suppress=True)  # Disable scientific notation
pd.options.display.float_format = '{:.2f}'.format  # Format floats to 2 decimal points
pd.set_option('display.max_columns', None)  # Display all columns in DataFrame

# Read training data
df_train = pd.read_csv("/Users/arpit/Downloads/Final Year Project/Train/social_media_train.csv", index_col=[0])
print(df_train.head())  # Show the first 5 rows of the training dataset

# Read data dictionary for description
data_dict = pd.read_csv("/Users/arpit/Downloads/Final Year Project/Data Description/fake_account__data_dict.csv", index_col="No.")
print(data_dict.head())
data_dict.info()  # Print summary info (columns, datatypes, etc.)

# Identify numerical features
num_cols = [
    "ratio_numlen_username", "len_fullname", "ratio_numlen_fullname",
    "len_desc", "num_posts", "num_followers", "num_following"
]

# Identify categorical columns (all columns not in num_cols)
cat_cols = [col for col in df_train.columns if col not in num_cols]
print("Categorical Columns:", cat_cols)

# Pie chart for fake vs. not fake
plt.figure(figsize=(10, 5))
fake_share = df_train["fake"].value_counts()
labels = ["Not Fake (0)", "Fake (1)"]
colors = ["#99ff99", "#ff9999"]
plt.pie(
    fake_share,
    labels=labels,
    autopct="%1.1f%%",
    colors=colors,
    textprops={"fontsize": 14}
)
plt.title("Target Category Distribution: Fake vs. Not Fake", fontsize=16)
plt.axis("equal")
plt.show(block=True)

# Calculate % of missing values per feature
percent_missing = df_train.isnull().mean() * 100
missing_value_df = pd.DataFrame({'Feature': percent_missing.index, 'Percent Missing (%)': percent_missing.values})
missing_value_df = missing_value_df.sort_values(by='Percent Missing (%)', ascending=False, ignore_index=True)
print(missing_value_df)

# Function to encode categorical data
def label_encoding(df):
    dict_label_encoding = {'Yes': 1, 'No': 0}
    df = df.replace(dict_label_encoding)
    cat_cols = df.select_dtypes(include=['object']).columns
    df = pd.get_dummies(df, columns=cat_cols, drop_first=True)
    df = df.apply(pd.to_numeric, errors='coerce')
    df = df.fillna(0)
    return df

df_train = label_encoding(df_train)

# Read and encode the test dataset
df_test = pd.read_csv("/Users/arpit/Downloads/Final Year Project/Test/social_media_test.csv", index_col=[0])
df_test = label_encoding(df_test)

features_train = df_train.drop(columns=['fake'])
target_train = df_train['fake']
features_test = df_test.drop(columns=['fake'])
target_test = df_test['fake']

# Train XGBoost
from xgboost import XGBClassifier
from sklearn.metrics import precision_score, recall_score

# Define hyperparameter grid for tuning
param_grid = {
    'n_estimators': [100, 200],
    'max_depth': [3, 5, 7],
    'learning_rate': [0.01, 0.1, 0.2],
    'subsample': [0.8, 1.0],
    'colsample_bytree': [0.8, 1.0]
}

# Set up GridSearchCV
grid_search_xgb = GridSearchCV(
    estimator=XGBClassifier(random_state=42, use_label_encoder=False, eval_metric='logloss'),
    param_grid=param_grid,
    cv=5,
    n_jobs=-1,
    scoring='roc_auc',
    verbose=1
)

# Fit the grid search to the training data
grid_search_xgb.fit(features_train, target_train)

# Get the best model
model_xgb = grid_search_xgb.best_estimator_
print("Best parameters found for XGBoost:", grid_search_xgb.best_params_)

# ROC Curve and AUC for XGBoost
from sklearn.metrics import roc_curve, roc_auc_score

target_test_pred_proba_xgb = model_xgb.predict_proba(features_test)[:, 1]
fpr_xgb, recall_xgb_curve, _ = roc_curve(target_test, target_test_pred_proba_xgb)

def roc_curve_plot(fpr, recall, label):
    plt.figure(figsize=(8, 6))
    plt.plot([0, 1], [0, 1], linestyle="--", label="Random Model", color="blue")
    plt.axvline(x=0, color='gray', linestyle="--")
    plt.axhline(y=1, color='gray', linestyle="--")
    plt.plot(fpr, recall, label=label, linewidth=2)
    plt.title("Receiver Operating Characteristic (ROC) Curve", fontsize=14)
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate (Recall)")
    plt.legend()
    plt.grid(True)
    plt.show(block=True)

roc_curve_plot(fpr_xgb, recall_xgb_curve, "XGBoost")
roc_auc_xgb = roc_auc_score(target_test, target_test_pred_proba_xgb)
print("ROC AUC Score (XGBoost):", roc_auc_xgb)


# Calculate Precision and Recall
target_test_pred = model_xgb.predict(features_test)
precision = precision_score(target_test, target_test_pred)
recall = recall_score(target_test, target_test_pred)

print("Precision Score (XGBoost):", precision)
print("Recall Score (XGBoost):", recall)


# Make predictions on new data
df_aim = pd.read_csv(r"/Users/arpit/Downloads/Final Year Project/Predict/social_media_aim.csv", index_col=[0])
df_aim = label_encoding(df_aim)
features_aim = df_aim.copy()
df_aim.loc[:, 'fake_pred_proba'] = model_xgb.predict_proba(features_aim)[:, 1]
df_aim.loc[:, 'fake_pred'] = model_xgb.predict(features_aim)
print(df_aim.head())
